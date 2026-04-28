import { GoogleGenAI, Type } from "@google/genai";
import { db, collection, getDocs } from "../lib/firebase";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface TriageResult {
  triage: {
    urgency: number;
    targetGroup: "Medical" | "Fire" | "Civil" | "Logistics";
    dispatchType: "AUTO" | "MANUAL";
    summary: string;
    ai_reasoning: string;
  };
  tasks: string[];
  manager_analysis: {
    group_tag: string;
    resource_impact: string;
    suggested_unit_size: number;
    group_specific_metric: string;
  };
}

async function getKeywordContext() {
  try {
    const snap = await getDocs(collection(db, 'sector_keywords'));
    const mapped = snap.docs.map(d => {
      const data = d.data();
      return `${data.sector}: [${(data.keywords || []).join(', ')}]`;
    });
    return mapped.join('\n');
  } catch (e) {
    console.error("Failed to fetch keywords", e);
    return "";
  }
}

export async function triageIncident(
  description: string, 
  availableVolunteers: {id: string, name: string, skills: string[], group?: string}[],
  imageData?: string, // base64
  audioData?: string  // base64
): Promise<TriageResult> {
  const keywordContext = await getKeywordContext();
  const groupStats = availableVolunteers.reduce((acc, v) => {
    const g = v.group || 'N/A';
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const resourceSummary = Object.entries(groupStats).map(([g, count]) => `${g}:${count}`).join(',');

  const MAX_RETRIES = 3;
  let retryCount = 0;

  async function executeTriage(): Promise<TriageResult> {
    try {
      const parts: any[] = [
        { text: `CONTEXT: ${description} | UNITS: ${resourceSummary}` }
      ];

      if (imageData) {
        parts.push({
          inlineData: {
            data: imageData.split(',')[1],
            mimeType: "image/jpeg"
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: `You are the CommuniSync Command-Agent. Your SOLE TASK is to route emergency data to the correct response sector.

USE THE FOLLOWING SECTOR KEYWORDS AS HARD TRIGGERS:
${keywordContext}

SECTOR DEFINITIONS (STRICT):
1. MEDICAL (CRITICAL): MUST be used if the text mentions: injury, pain, blood, head, unconscious, fainting, breathing, nurse, doctor, paramedic, clinic, or ANY keywords from the Medical list above. If there is ANY mention of physical trauma, classify as MEDICAL regardless of other context.
2. FIRE: Active fire, smoke, hazardous chemicals, heat-related collapse, or Fire keywords.
3. LOGISTICS: Structural clearing, debris, heavy lifting, transporting machines, moving supplies, providing blankets/tents, or Logistics keywords.
4. CIVIL: Admin, news, general coordination, missing persons with no reported injury, food/water info (not clinical), low-priority public safety, or Civil keywords.

HIERARCHY & DEFAULTS:
- DEFAULT: If you are unsure or the context is ambiguous, you MUST select MEDICAL.
- PRIORITY: Medical > Fire > Logistics > Civil. If multiple sectors could apply (e.g., "fire with casualties"), ALWAYS select the higher one in this list (MEDICAL in that case).
- Urgency: 1 (Life-Threatening) to 5 (Informational).`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              triage: {
                type: Type.OBJECT,
                properties: {
                  urgency: { type: Type.NUMBER, description: "1-5 scale, 1 is highest priority" },
                  targetGroup: { type: Type.STRING, enum: ["Medical", "Fire", "Civil", "Logistics"] },
                  dispatchType: { type: Type.STRING, enum: ["AUTO", "MANUAL"] },
                  summary: { type: Type.STRING },
                  ai_reasoning: { type: Type.STRING, description: "One sentence explaining sector choice" }
                },
                required: ["urgency", "targetGroup", "dispatchType", "summary", "ai_reasoning"]
              },
              tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
              manager_analysis: {
                type: Type.OBJECT,
                properties: {
                  group_tag: { type: Type.STRING },
                  resource_impact: { type: Type.STRING },
                  suggested_unit_size: { type: Type.NUMBER },
                  group_specific_metric: { type: Type.STRING }
                },
                required: ["group_tag", "resource_impact", "suggested_unit_size", "group_specific_metric"]
              }
            },
            required: ["triage", "tasks", "manager_analysis"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      const parsed = JSON.parse(text);
      
      const result: TriageResult = {
        triage: {
          urgency: Number(parsed.triage?.urgency) || 3,
          targetGroup: (['Medical', 'Fire', 'Logistics', 'Civil'].includes(parsed.triage?.targetGroup) ? parsed.triage.targetGroup : 'Medical') as any,
          dispatchType: parsed.triage?.dispatchType === 'AUTO' ? 'AUTO' : 'MANUAL',
          summary: String(parsed.triage?.summary || "No summary provided"),
          ai_reasoning: String(parsed.triage?.ai_reasoning || "No reasoning provided")
        },
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((t: any) => String(t)) : [],
        manager_analysis: {
          group_tag: String(parsed.manager_analysis?.group_tag || "General"),
          resource_impact: String(parsed.manager_analysis?.resource_impact || "Standard"),
          suggested_unit_size: Number(parsed.manager_analysis?.suggested_unit_size) || 1,
          group_specific_metric: String(parsed.manager_analysis?.group_specific_metric || "N/A")
        }
      };

      return result;
    } catch (error: any) {
      const isRateLimit = 
        error?.status === 429 || 
        error?.error?.code === 429 || 
        (error?.message && error.message.includes('429')) ||
        (error?.message && error.message.includes('RESOURCE_EXHAUSTED'));

      if (isRateLimit && retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
        console.warn(`AI Rate limited (429). Retrying ${retryCount}/${MAX_RETRIES} after ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeTriage();
      }
      throw error;
    }
  }

  try {
    return await executeTriage();
  } catch (error) {
    console.error("AI Triage failed, use fallback:", error);
    return {
      triage: { urgency: 3, targetGroup: "Medical", dispatchType: "MANUAL", summary: "Auto-triaged due to system failure", ai_reasoning: "Fallback logic applied due to AI error" },
      tasks: ["Assess situation locally", "Manual review required"],
      manager_analysis: { group_tag: "MEDICAL", resource_impact: "UNKNOWN", suggested_unit_size: 1, group_specific_metric: "Low" }
    };
  }
}
