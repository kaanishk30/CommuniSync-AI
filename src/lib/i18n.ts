import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "app_name": "CommuniSync",
      "portal_title": "Deployment Portal",
      "portal_subtitle": "Establish secure uplink to central command",
      "reporter_label": "Crisis Reporter",
      "reporter_desc": "Secure report entry for ground units and survivors",
      "volunteer_label": "Response Unit",
      "volunteer_desc": "Field operation node for verified responders",
      "manager_label": "Mission Control",
      "manager_desc": "Strategic orchestration and system telemetry",
      "identity_auth": "Identity Auth",
      "initialize_node": "Initialize New Node",
      "secure_uplink": "Secure Uplink",
      "accessing_node": "Accessing {{role}} Node",
      "identity_clearance": "Identity clearance required",
      "google_auth": "Google Security Auth",
      "emergency_access": "Emergency Access",
      "resume_session": "Resume Session",
      "management_protocol": "Management Protocol",
      "terminate_session": "Terminate Session",
      "reporter": "Crisis Reporter",
      "volunteer": "Response Volunteer",
      "manager": "Strategic Manager",
      "report_incident": "Report Incident",
      "active_units": "Active Units",
      "medical": "Medical",
      "fire": "Fire",
      "civil": "Civil",
      "logistics": "Logistics",
      "select_language": "Select Language"
    }
  },
  hi: {
    translation: {
      "app_name": "कम्यूनीसिंक",
      "portal_title": "परिनियोजन पोर्टल",
      "portal_subtitle": "केंद्रीय कमान के लिए सुरक्षित अपलिंक स्थापित करें",
      "reporter_label": "संकट रिपोर्टर",
      "reporter_desc": "ग्राउंड इकाइयों और बचे लोगों के लिए सुरक्षित रिपोर्ट प्रविष्टि",
      "volunteer_label": "प्रतिक्रिया इकाई",
      "volunteer_desc": "सत्यापित उत्तरदाताओं के लिए फील्ड ऑपरेशन नोड",
      "manager_label": "मिशन नियंत्रण",
      "manager_desc": "रणनीतिक ऑर्केस्ट्रेशन और सिस्टम टेलीमेट्री",
      "identity_auth": "पहचान प्रमाणित करें",
      "initialize_node": "नया नोड प्रारंभ करें",
      "secure_uplink": "सुरक्षित अपलिंक",
      "accessing_node": "{{role}} नोड एक्सेस कर रहे हैं",
      "identity_clearance": "पहचान निकासी आवश्यक",
      "google_auth": "गूगल सुरक्षा प्रमाणीकरण",
      "emergency_access": "आपातकालीन पहुंच",
      "resume_session": "सत्र फिर से शुरू करें",
      "management_protocol": "प्रबंधन प्रोटोकॉल",
      "terminate_session": "सत्र समाप्त करें",
      "reporter": "संकट रिपोर्टर",
      "volunteer": "प्रतिक्रिया स्वयंसेवक",
      "manager": "रणनीतिक प्रबंधक",
      "report_incident": "घटना की रिपोर्ट करें",
      "active_units": "सक्रिय इकाइयां",
      "medical": "चिकित्सा",
      "fire": "आग",
      "civil": "नागरिक",
      "logistics": "रसद",
      "select_language": "भाषा चुनें"
    }
  },
  kn: {
    translation: {
      "app_name": "ಕಮ್ಯೂನಿಸಿನಿಂಕ್",
      "portal_title": "ನಿಯೋಜನೆ ಪೋರ್ಟಲ್",
      "portal_subtitle": "ಕೇಂದ್ರ ಕಮಾಂಡ್‌ಗೆ ಸುರಕ್ಷಿತ ಅಪ್ಲಿಂಕ್ ಸ್ಥಾಪಿಸಿ",
      "reporter_label": "ಬಿಕ್ಕಟ್ಟು ವರದಿಗಾರ",
      "reporter_desc": "ನೆಲದ ಘಟಕಗಳು ಮತ್ತು ಬದುಕುಳಿದವರಿಗೆ ಸುರಕ್ಷಿತ ವರದಿ ಪ್ರವೇಶ",
      "volunteer_label": "ಪ್ರತಿಕ್ರಿಯೆ ಘಟಕ",
      "volunteer_desc": "ಪರಿಶೀಲಿಸಿದ ಪ್ರತಿಕ್ರಿಯೆ ನೀಡುವವರಿಗೆ ಕ್ಷೇತ್ರ ಕಾರ್ಯಾಚರಣೆಯ ನೋಡ್",
      "manager_label": "ಮಿಷನ್ ನಿಯಂತ್ರಣ",
      "manager_desc": "ಕಾರ್ಯತಂತ್ರದ ಯೋಜನೆ ಮತ್ತು ಸಿಸ್ಟಮ್ ಟೆಲಿಮೆಟ್ರಿ",
      "identity_auth": "ಗುರುತಿನ ದೃಢೀಕರಣ",
      "initialize_node": "ಹೊಸ ನೋಡ್ ಪ್ರಾರಂಭಿಸಿ",
      "secure_uplink": "ಸುರಕ್ಷಿತ ಅಪ್ಲಿಂಕ್",
      "accessing_node": "{{role}} ನೋಡ್ ಪ್ರವೇಶಿಸಲಾಗುತ್ತಿದೆ",
      "identity_clearance": "ಗುರುತಿನ ಅನುಮತಿ ಅಗತ್ಯವಿದೆ",
      "google_auth": "ಗೂಗಲ್ ಭದ್ರತಾ ದೃಢೀಕರಣ",
      "emergency_access": "ತುರ್ತು ಪ್ರವೇಶ",
      "resume_session": "ಸಧನ ಮುಂದುವರಿಸಿ",
      "management_protocol": "ನಿರ್ವಹಣೆ ಪ್ರೋಟೋಕಾಲ್",
      "terminate_session": "ಸಧನ ಅಂತ್ಯಗೊಳಿಸಿ",
      "reporter": "ಬಿಕ್ಕಟ್ಟು ವರದಿಗಾರ",
      "volunteer": "ಪ್ರತಿಕ್ರಿಯೆ ಸ್ವಯಂಸೇವಕ",
      "manager": "ಕಾರ್ಯತಂತ್ರದ ವ್ಯವಸ್ಥಾಪಕ",
      "report_incident": "ಘಟನೆಯನ್ನು ವರದಿ ಮಾಡಿ",
      "active_units": "ಸಕ್ರಿಯ ಘಟಕಗಳು",
      "medical": "ವೈದ್ಯಕೀಯ",
      "fire": "ಅಗ್ನಿಶಾಮಕ",
      "civil": "ನಾಗರಿಕ",
      "logistics": "ಸಾಗಾಣಿಕೆ",
      "select_language": "ಭಾಷೆಯನ್ನು ಆರಿಸಿ"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    }
  });

export default i18n;
