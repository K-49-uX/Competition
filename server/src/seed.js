import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from './db.js';
import { config } from './config.js';
import { User } from './models/User.js';
import { Clinic } from './models/Clinic.js';
import { EducationContent } from './models/EducationContent.js';
import { Notification } from './models/Notification.js';

// Kakuma Refugee Camp & Kalobeyei Settlement ~ 3.7172° N, 34.8689° E
// Health facilities operated by IRC, UNHCR, AMREF, IOM, KRCS and Ministry of Health
// partners across Kakuma 1-4 and Kalobeyei Villages 1-3.
const CLINICS = [
  // Hospitals (referral level)
  { name: 'Amusait Hospital (IRC)', address: 'Kakuma 1, Main Camp', services: ['general', 'maternal', 'surgery', 'pharmacy', 'lab', 'inpatient'], hours: '24/7', lng: 34.8702, lat: 3.7185, avgServiceMinutes: 12 },
  { name: 'Kakuma Mission Hospital', address: 'Kakuma Town', services: ['general', 'maternal', 'pharmacy', 'lab', 'inpatient'], hours: '24/7', lng: 34.8745, lat: 3.7150, avgServiceMinutes: 12 },
  { name: 'Kakuma Sub-County Hospital (MoH)', address: 'Kakuma Town', services: ['general', 'maternal', 'pharmacy', 'lab', 'inpatient'], hours: '24/7', lng: 34.8718, lat: 3.7128, avgServiceMinutes: 14 },

  // Kakuma 1
  { name: 'Locher Angamor Health Post (IRC)', address: 'Kakuma 1, Zone 2', services: ['general', 'maternal', 'vaccination'], hours: '08:00 - 17:00', lng: 34.8665, lat: 3.7205, avgServiceMinutes: 8 },
  { name: 'Clinic 1 — Kakuma 1 Dispensary', address: 'Kakuma 1, Block C', services: ['general', 'pharmacy'], hours: '08:00 - 17:00', lng: 34.8680, lat: 3.7160, avgServiceMinutes: 7 },

  // Kakuma 2
  { name: 'Nalemsekon Health Post (IRC)', address: 'Kakuma 2, Zone 4', services: ['general', 'maternal', 'vaccination', 'pharmacy'], hours: '08:00 - 18:00', lng: 34.8610, lat: 3.7090, avgServiceMinutes: 9 },
  { name: 'Clinic 2 — Kakuma 2 Dispensary', address: 'Kakuma 2, Block B', services: ['general', 'pharmacy'], hours: '08:00 - 17:00', lng: 34.8595, lat: 3.7050, avgServiceMinutes: 7 },

  // Kakuma 3
  { name: 'Natukobenyo Health Post (IRC)', address: 'Kakuma 3, Zone 1', services: ['general', 'maternal', 'vaccination'], hours: '08:00 - 17:00', lng: 34.8540, lat: 3.6990, avgServiceMinutes: 8 },
  { name: 'Clinic 3 — Kakuma 3 Dispensary', address: 'Kakuma 3, Block D', services: ['general', 'pharmacy'], hours: '08:00 - 17:00', lng: 34.8520, lat: 3.6955, avgServiceMinutes: 7 },
  { name: 'AMREF Reproductive Health Clinic', address: 'Kakuma 3', services: ['maternal', 'family-planning', 'hiv'], hours: '08:00 - 17:00', lng: 34.8505, lat: 3.6975, avgServiceMinutes: 10 },

  // Kakuma 4
  { name: 'Lopur Health Post (IRC)', address: 'Kakuma 4, Zone 3', services: ['general', 'maternal', 'vaccination'], hours: '08:00 - 17:00', lng: 34.8470, lat: 3.6890, avgServiceMinutes: 8 },
  { name: 'Clinic 4 — Kakuma 4 Dispensary', address: 'Kakuma 4, Block A', services: ['general', 'pharmacy'], hours: '08:00 - 17:00', lng: 34.8455, lat: 3.6860, avgServiceMinutes: 7 },
  { name: 'Kakuma 4 Community Pharmacy', address: 'Kakuma 4, Market Area', services: ['pharmacy'], hours: '08:00 - 19:00', lng: 34.8485, lat: 3.6905, avgServiceMinutes: 5 },

  // Kalobeyei Settlement
  { name: 'Kalobeyei Main Health Centre (IRC)', address: 'Kalobeyei Village 1', services: ['general', 'maternal', 'vaccination', 'pharmacy', 'lab'], hours: '24/7', lng: 34.7820, lat: 3.7820, avgServiceMinutes: 10 },
  { name: 'Kalobeyei Village 2 Health Post', address: 'Kalobeyei Village 2', services: ['general', 'maternal', 'vaccination'], hours: '08:00 - 17:00', lng: 34.7755, lat: 3.7755, avgServiceMinutes: 9 },
  { name: 'Kalobeyei Village 3 Health Post', address: 'Kalobeyei Village 3', services: ['general', 'vaccination'], hours: '08:00 - 17:00', lng: 34.7690, lat: 3.7690, avgServiceMinutes: 9 },

  // Specialist / supporting facilities
  { name: 'IOM Migration Health Clinic', address: 'Kakuma Reception Centre', services: ['general', 'screening', 'vaccination'], hours: '08:00 - 17:00', lng: 34.8705, lat: 3.7220, avgServiceMinutes: 10 },
  { name: 'KRCS First Aid Post', address: 'Kakuma Town Centre', services: ['first-aid', 'emergency'], hours: '24/7', lng: 34.8730, lat: 3.7170, avgServiceMinutes: 6 },
  { name: 'TB & HIV Care Centre (IRC)', address: 'Kakuma 1', services: ['tb', 'hiv', 'pharmacy'], hours: '08:00 - 17:00', lng: 34.8688, lat: 3.7150, avgServiceMinutes: 12 },
  { name: 'Mental Health & Psychosocial Unit (JRS)', address: 'Kakuma 3', services: ['mental-health', 'counselling'], hours: '09:00 - 16:00', lng: 34.8530, lat: 3.6940, avgServiceMinutes: 20 },
];

// Trusted health organisations (top-level pages — stable URLs)
const ORGS = {
  WHO: { home: 'https://www.who.int' },
  UNHCR: { home: 'https://www.unhcr.org' },
  UNICEF: { home: 'https://www.unicef.org' },
  CDC: { home: 'https://www.cdc.gov' },
  MSF: { home: 'https://www.msf.org' },
  IFRC: { home: 'https://www.ifrc.org' },
};

// Each topic: slug, category, icon, title, body (short),
// details (long paragraphs), keyFacts (bullets), resources (external links).
// Translations only swap title + body; details/facts/resources are kept in English
// (clients fall back to English when their language version is missing).
const TOPICS = [
  {
    slug: 'hand-washing',
    category: 'hygiene',
    icon: '🧼',
    en: {
      title: 'Hand Washing Saves Lives',
      body: 'Wash hands with soap for at least 20 seconds before eating and after using the toilet.',
      details: [
        'Hand washing with soap is one of the most effective and affordable ways to prevent diarrhoeal disease, pneumonia, and outbreaks such as cholera and Ebola.',
        'In refugee and displacement settings, simple hand-washing stations near latrines and food areas can reduce disease transmission by up to 40%.',
        'When soap and clean water are not available, an alcohol-based hand rub can be used, but visible dirt must first be wiped away.',
      ],
      keyFacts: [
        'Wet hands, lather with soap, scrub for 20 seconds, rinse, dry.',
        'Critical times: after toilet, before food, before feeding a child, after caring for someone sick.',
        'Children should be taught hand-washing as a daily routine.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Hand hygiene — health topic', url: 'https://www.who.int/health-topics/hand-hygiene', description: 'WHO guidance on hand hygiene for health workers and the public.' },
      { org: 'UNICEF', title: 'Water, sanitation and hygiene (WASH)', url: 'https://www.unicef.org/wash', description: 'UNICEF programmes on hygiene in schools, households and emergencies.' },
      { org: 'CDC', title: 'Clean Hands save lives', url: 'https://www.cdc.gov/handwashing/', description: 'Step-by-step hand-washing guidance and posters.' },
      { org: 'UNHCR', title: 'Public Health in refugee settings', url: 'https://www.unhcr.org/what-we-do/build-better-futures/public-health', description: 'UNHCR public-health programmes including hygiene promotion.' },
    ],
  },
  {
    slug: 'safe-water',
    category: 'hygiene',
    icon: '🚰',
    en: {
      title: 'Safe Drinking Water',
      body: 'Always boil or treat water before drinking, especially during outbreaks.',
      details: [
        'Unsafe water causes diarrhoeal diseases that kill hundreds of thousands of children every year. In camps, contaminated water is the leading cause of acute watery diarrhoea outbreaks.',
        'Bring water to a rolling boil for at least 1 minute (3 minutes above 2,000 m altitude). Chlorine tablets, bleach drops, or solar disinfection (SODIS) are also effective when boiling is not possible.',
        'Store treated water in a covered container with a narrow opening and a tap or ladle to prevent recontamination by hands.',
      ],
      keyFacts: [
        'Boil for at least 1 minute, or use a chlorine tablet per 1L.',
        'Cover storage containers and never dip dirty cups into them.',
        'Wash storage containers weekly with soap and clean water.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Drinking-water — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/drinking-water', description: 'Global statistics, standards, and household water treatment guidance.' },
      { org: 'WHO', title: 'Water, sanitation and hygiene (WASH)', url: 'https://www.who.int/health-topics/water-sanitation-and-hygiene-wash', description: 'WHO health topic page on WASH.' },
      { org: 'UNHCR', title: 'WASH in refugee operations', url: 'https://www.unhcr.org/what-we-do/build-better-futures/livelihoods-and-economic-inclusion/wash', description: 'UNHCR standards for safe water supply in camps.' },
      { org: 'CDC', title: 'Healthy Water', url: 'https://www.cdc.gov/healthywater/', description: 'CDC guidance on safe water at home and during emergencies.' },
    ],
  },
  {
    slug: 'balanced-meals',
    category: 'nutrition',
    icon: '🥗',
    en: {
      title: 'Balanced Meals',
      body: 'Combine grains, proteins (beans/meat), and vegetables in every meal.',
      details: [
        'A balanced meal contains energy foods (cereals, roots), body-building foods (beans, lentils, eggs, fish, meat, milk), and protective foods (fruits and vegetables). Eating from all three groups prevents undernutrition and micronutrient deficiencies.',
        'Children under five and pregnant women have especially high nutrient needs and benefit most from diverse meals. Adding a small amount of oil or groundnut paste increases the energy density of porridge for young children.',
        'In camp settings, fortified blended foods (such as Super Cereal) and ready-to-use therapeutic foods are used to treat acute malnutrition under clinic supervision.',
      ],
      keyFacts: [
        'Aim for at least 5 of the 10 food groups daily for adults.',
        'Add a fruit or vegetable to every meal when available.',
        'Iodised salt prevents goitre and supports brain development.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Healthy diet — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet', description: 'WHO recommendations on a healthy diet across the life course.' },
      { org: 'WHO', title: 'Nutrition — health topic', url: 'https://www.who.int/health-topics/nutrition', description: 'Nutrition policy, guidelines and country support.' },
      { org: 'UNICEF', title: 'Nutrition programmes', url: 'https://www.unicef.org/nutrition', description: 'UNICEF child and maternal nutrition work in 130+ countries.' },
      { org: 'UNHCR', title: 'Nutrition in refugee settings', url: 'https://www.unhcr.org/what-we-do/build-better-futures/public-health/nutrition-and-food-security', description: 'UNHCR food security and nutrition programmes.' },
    ],
  },
  {
    slug: 'breastfeeding',
    category: 'nutrition',
    icon: '🤱',
    en: {
      title: 'Breastfeeding',
      body: 'Exclusive breastfeeding for the first 6 months protects infants from disease.',
      details: [
        'WHO and UNICEF recommend that infants be breastfed within one hour of birth, exclusively breastfed for the first 6 months, and continue breastfeeding alongside complementary foods up to 2 years of age or beyond.',
        'Breast milk provides all the energy and nutrients an infant needs in the first months and contains antibodies that protect against diarrhoea and pneumonia — the two leading causes of child death globally.',
        'Mothers benefit too: breastfeeding reduces the risk of breast and ovarian cancer, and supports recovery after childbirth. In emergencies, supporting breastfeeding is one of the most life-saving interventions.',
      ],
      keyFacts: [
        'Start within 1 hour of birth.',
        'Exclusive breast milk for 6 months — no water, no other foods.',
        'Continue breastfeeding to 2 years with complementary foods.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Breastfeeding — health topic', url: 'https://www.who.int/health-topics/breastfeeding', description: 'WHO global guidance and the 10 Steps to Successful Breastfeeding.' },
      { org: 'UNICEF', title: 'Breastfeeding', url: 'https://www.unicef.org/nutrition/breastfeeding', description: 'UNICEF resources for parents and health workers.' },
      { org: 'CDC', title: 'Breastfeeding', url: 'https://www.cdc.gov/breastfeeding/', description: 'Practical guidance and research on breastfeeding.' },
      { org: 'UNHCR', title: 'Infant and young child feeding in emergencies', url: 'https://www.unhcr.org/what-we-do/build-better-futures/public-health/nutrition-and-food-security', description: 'UNHCR guidance for protecting breastfeeding in displacement.' },
    ],
  },
  {
    slug: 'antenatal-care',
    category: 'maternal',
    icon: '🤰',
    en: {
      title: 'Antenatal Visits',
      body: 'Attend at least 4 antenatal check-ups during pregnancy.',
      details: [
        'WHO recommends a minimum of 8 antenatal contacts during pregnancy to reduce perinatal mortality and improve a woman\u2019s experience of care. Even where 8 visits are not possible, 4 focused visits make a major difference.',
        'Antenatal care includes blood-pressure checks, screening for anaemia, HIV and syphilis, tetanus vaccination, intermittent preventive treatment for malaria where indicated, and birth-preparedness counselling.',
        'Skilled attendance at birth, plus access to emergency obstetric care, is the single most effective intervention for reducing maternal deaths.',
      ],
      keyFacts: [
        'Book the first visit as soon as you know you are pregnant.',
        'Bring your antenatal card to every visit.',
        'Plan where you will deliver — and a back-up plan.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Maternal health — health topic', url: 'https://www.who.int/health-topics/maternal-health', description: 'WHO maternal-health strategies and guidelines.' },
      { org: 'WHO', title: 'Antenatal care recommendations', url: 'https://www.who.int/publications/i/item/9789241549912', description: '2016 WHO ANC recommendations for a positive pregnancy experience.' },
      { org: 'UNICEF', title: 'Maternal health', url: 'https://www.unicef.org/health/maternal-and-newborn-health', description: 'UNICEF programmes for safe motherhood.' },
      { org: 'UNHCR', title: 'Reproductive health in refugee settings', url: 'https://www.unhcr.org/what-we-do/build-better-futures/public-health/reproductive-health', description: 'UNHCR services for safe pregnancy and delivery.' },
    ],
  },
  {
    slug: 'iron-folic-acid',
    category: 'maternal',
    icon: '💊',
    en: {
      title: 'Iron & Folic Acid',
      body: 'Take prenatal supplements daily to prevent anemia.',
      details: [
        'Iron-deficiency anaemia in pregnancy increases the risk of preterm birth, low birth weight, and maternal death. WHO recommends daily oral iron (30\u201360 mg) and folic acid (400 \u00b5g) for all pregnant women.',
        'Folic acid taken before conception and in the first trimester prevents neural tube defects such as spina bifida. Where possible, women planning pregnancy should also take folic acid.',
        'Take supplements with water (not tea or coffee, which block absorption). Mild stomach upset is common in the first weeks; do not stop without speaking to a clinician.',
      ],
      keyFacts: [
        'One tablet a day, every day of pregnancy.',
        'Take with food if it upsets your stomach.',
        'Continue for 3 months after delivery if anaemia was diagnosed.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Anaemia in women and children', url: 'https://www.who.int/health-topics/anaemia', description: 'WHO programmes and recommendations on anaemia prevention.' },
      { org: 'WHO', title: 'Daily iron and folic acid supplementation', url: 'https://www.who.int/tools/elena/interventions/daily-iron-pregnancy', description: 'eLENA technical guidance on supplementation in pregnancy.' },
      { org: 'UNICEF', title: 'Maternal nutrition', url: 'https://www.unicef.org/nutrition/maternal', description: 'UNICEF resources on nutrition before and during pregnancy.' },
    ],
  },
  {
    slug: 'childhood-vaccines',
    category: 'general',
    icon: '💉',
    en: {
      title: 'Vaccinate Your Children',
      body: 'Childhood vaccines prevent measles, polio, and other deadly diseases.',
      details: [
        'Vaccines prevent an estimated 4 million deaths every year. The expanded programme on immunization (EPI) protects children against tuberculosis, polio, diphtheria, tetanus, pertussis, hepatitis B, Haemophilus influenzae type b, pneumococcal disease, rotavirus, measles and rubella.',
        'In refugee settings, measles vaccination is one of the first interventions during a new emergency because measles outbreaks can kill many children quickly.',
        'Bring your child\u2019s vaccination card to every clinic visit so missed doses can be caught up. It is safe to vaccinate a child who has a mild cold.',
      ],
      keyFacts: [
        'Most vaccines are given in the first 2 years of life.',
        'Mild fever or sore arm after a vaccine is normal.',
        'Catch-up vaccinations are available — never too late to start.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Immunization — health topic', url: 'https://www.who.int/health-topics/immunization', description: 'WHO recommended immunization schedules and policy.' },
      { org: 'UNICEF', title: 'Immunization', url: 'https://www.unicef.org/immunization', description: 'UNICEF supplies vaccines for nearly half the world\u2019s children.' },
      { org: 'CDC', title: 'Vaccines & Immunizations', url: 'https://www.cdc.gov/vaccines/', description: 'Detailed schedules, safety information and parent guidance.' },
      { org: 'UNHCR', title: 'Immunization for refugees', url: 'https://www.unhcr.org/what-we-do/build-better-futures/public-health', description: 'UNHCR public-health programmes including routine and outbreak vaccination.' },
    ],
  },
  {
    slug: 'malaria-prevention',
    category: 'general',
    icon: '🦟',
    en: {
      title: 'Sleep Under a Net',
      body: 'Use treated mosquito nets every night to prevent malaria.',
      details: [
        'Malaria is transmitted by infected mosquitoes that bite mainly at night. Insecticide-treated nets (ITNs) reduce malaria transmission and child mortality by around 20%.',
        'Tuck the net under the mattress every night. Repair small holes promptly with thread or a patch. Wash the net gently in cool water no more than once a month so the insecticide lasts.',
        'Seek care immediately for fever in pregnant women and children under 5 \u2014 untreated malaria can become severe within 24 hours.',
      ],
      keyFacts: [
        'Use the net every night, all year.',
        'Pregnant women and young children are highest priority.',
        'Fever + chills = test for malaria the same day.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Malaria — health topic', url: 'https://www.who.int/health-topics/malaria', description: 'WHO global malaria programme, guidelines, and statistics.' },
      { org: 'WHO', title: 'World Malaria Report', url: 'https://www.who.int/teams/global-malaria-programme/reports/world-malaria-report-2023', description: 'Annual data on malaria burden and progress.' },
      { org: 'CDC', title: 'Malaria', url: 'https://www.cdc.gov/malaria/', description: 'Prevention, treatment and traveller information.' },
      { org: 'MSF', title: 'Malaria — disease information', url: 'https://www.msf.org/malaria', description: 'How M\u00e9decins Sans Fronti\u00e8res treats malaria in the field.' },
      { org: 'UNHCR', title: 'Malaria control in refugee operations', url: 'https://www.unhcr.org/what-we-do/build-better-futures/public-health', description: 'UNHCR malaria prevention in camps.' },
    ],
  },  {
    slug: 'diarrhoea-ors',
    category: 'general',
    icon: '💧',
    en: {
      title: 'Treating Diarrhoea with ORS & Zinc',
      body: 'Give Oral Rehydration Salts and zinc tablets to a child with diarrhoea.',
      details: [
        'Diarrhoea kills children mainly through dehydration. Oral rehydration salts (ORS) restore lost fluids and salts; combined with zinc supplementation for 10–14 days they reduce duration and severity.',
        'Continue feeding throughout the illness — including breastfeeding for infants. Withholding food prolongs recovery and worsens malnutrition.',
        'Seek care urgently if there is blood in the stool, sunken eyes, no urine for 6 hours, persistent vomiting, or the child is unusually sleepy.',
      ],
      keyFacts: [
        'Mix one ORS sachet in 1 litre of safe water.',
        'Give a few sips every 1–2 minutes for young children.',
        'Zinc 20 mg daily for 10–14 days (10 mg for infants under 6 months).',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Diarrhoeal disease — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/diarrhoeal-disease', description: 'Global statistics, prevention and treatment.' },
      { org: 'UNICEF', title: 'Diarrhoea', url: 'https://data.unicef.org/topic/child-health/diarrhoeal-disease/', description: 'UNICEF data and programmes on diarrhoea control.' },
      { org: 'CDC', title: 'Global diarrhea burden', url: 'https://www.cdc.gov/healthywater/global/diarrhea-burden.html', description: 'CDC global health page on diarrhoea.' },
    ],
  },
  {
    slug: 'pneumonia-children',
    category: 'general',
    icon: '🫁',
    en: {
      title: 'Spotting Pneumonia in Children',
      body: 'Fast or difficult breathing in a child needs same-day care.',
      details: [
        'Pneumonia is the leading infectious cause of death in children under 5. Recognising the early signs and seeking treatment within 24 hours saves lives.',
        'Danger signs: rapid breathing (more than 50 breaths/min in infants 2–12 months, more than 40 in children 1–5 years), chest in-drawing, inability to drink, persistent vomiting, convulsions or unusual sleepiness.',
        'Vaccination (Hib, pneumococcal, measles), exclusive breastfeeding for the first 6 months, good nutrition and reducing indoor smoke all help prevent pneumonia.',
      ],
      keyFacts: [
        'Count breaths for a full minute when the child is calm.',
        'Antibiotics are needed for bacterial pneumonia — do not delay seeking care.',
        'Keep cooking smoke away from the child.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Pneumonia in children — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/pneumonia', description: 'Causes, symptoms, prevention and treatment.' },
      { org: 'UNICEF', title: 'Pneumonia', url: 'https://data.unicef.org/topic/child-health/pneumonia/', description: 'Burden and prevention strategies.' },
    ],
  },
  {
    slug: 'tuberculosis',
    category: 'general',
    icon: '🩺',
    en: {
      title: 'Tuberculosis (TB): Test & Treat',
      body: 'A cough lasting more than two weeks may be TB — get a free test.',
      details: [
        'Tuberculosis is a curable bacterial infection that mainly affects the lungs but can also affect other organs. It spreads when someone with active lung TB coughs or sneezes.',
        'Common symptoms: persistent cough (more than 2 weeks), fever, night sweats, weight loss, and chest pain. People living with HIV are at much higher risk.',
        'TB treatment is free in most countries. It takes 6 months and must be completed even if symptoms improve, otherwise drug-resistant TB can develop.',
      ],
      keyFacts: [
        'TB testing and treatment are free at public clinics.',
        'Cover your mouth when coughing and improve ventilation at home.',
        'Take every dose for the full 6 months.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Tuberculosis — health topic', url: 'https://www.who.int/health-topics/tuberculosis', description: 'WHO TB programme, guidelines, and global report.' },
      { org: 'CDC', title: 'TB basics', url: 'https://www.cdc.gov/tb/topic/basics/', description: 'How TB spreads, symptoms, and treatment.' },
      { org: 'MSF', title: 'Tuberculosis', url: 'https://www.msf.org/tuberculosis', description: 'MSF field experience treating drug-resistant TB.' },
    ],
  },
  {
    slug: 'hiv-prevention',
    category: 'general',
    icon: '🎗️',
    en: {
      title: 'HIV Prevention & Testing',
      body: 'Know your status. Modern treatment lets people with HIV live full healthy lives.',
      details: [
        'HIV is transmitted through unprotected sex, sharing needles, and from mother to child during pregnancy, birth or breastfeeding. It is NOT spread by hugging, sharing food, or mosquitoes.',
        'Prevention works: condoms, pre-exposure prophylaxis (PrEP) for high-risk people, voluntary medical male circumcision, and treating pregnant women living with HIV to prevent mother-to-child transmission.',
        'Antiretroviral therapy (ART) reduces the virus to undetectable levels. People with an undetectable viral load cannot pass HIV through sex (U=U: undetectable = untransmittable).',
      ],
      keyFacts: [
        'HIV testing is free, fast and confidential.',
        'Start ART immediately after diagnosis — earlier is better.',
        'Condoms protect against HIV and other STIs.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'HIV — health topic', url: 'https://www.who.int/health-topics/hiv-aids', description: 'WHO HIV programme, guidelines, statistics.' },
      { org: 'UNICEF', title: 'HIV/AIDS', url: 'https://www.unicef.org/hiv', description: 'Preventing mother-to-child transmission.' },
      { org: 'CDC', title: 'HIV basics', url: 'https://www.cdc.gov/hiv/basics/', description: 'Transmission, prevention, testing.' },
      { org: 'MSF', title: 'HIV/AIDS', url: 'https://www.msf.org/hivaids', description: 'MSF HIV programmes and treatment.' },
    ],
  },
  {
    slug: 'family-planning',
    category: 'maternal',
    icon: '🤝',
    en: {
      title: 'Family Planning Choices',
      body: 'You have the right to decide if and when to have children — many safe options exist.',
      details: [
        'Family planning lets women and couples space pregnancies, finish school, and protect maternal and child health. Spacing pregnancies at least 2 years apart reduces newborn deaths by up to 30%.',
        'Methods include: short-acting (pills, injections, condoms), long-acting reversible (implants, IUDs that last 3–10 years), and permanent (tubal ligation, vasectomy). A trained provider can help you choose what fits your life.',
        'Modern methods do not cause infertility. Fertility returns within weeks to months after stopping most methods.',
      ],
      keyFacts: [
        'All methods are free at public clinics.',
        'Condoms also prevent HIV and other STIs.',
        'Discuss options with a provider — counselling is confidential.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Family planning / contraception', url: 'https://www.who.int/news-room/fact-sheets/detail/family-planning-contraception', description: 'Methods, effectiveness, and rights.' },
      { org: 'UNICEF', title: 'Adolescent health', url: 'https://www.unicef.org/health/adolescent-health', description: 'Reproductive health for young people.' },
      { org: 'IFRC', title: 'Sexual and reproductive health', url: 'https://www.ifrc.org/our-work/health-and-care/sexual-and-reproductive-health', description: 'IFRC SRH services in emergencies.' },
    ],
  },
  {
    slug: 'mental-health',
    category: 'general',
    icon: '🧠',
    en: {
      title: 'Caring for Your Mental Health',
      body: 'Stress, sadness and anxiety are common — and treatable. You are not alone.',
      details: [
        'Living through displacement, loss or hardship can affect mental health. Common signs include constant worry, trouble sleeping, loss of interest, hopelessness, or thoughts of self-harm.',
        'Simple things that help: talking to someone you trust, regular routines, physical activity, breathing exercises, limiting alcohol, and connecting with community or faith groups.',
        'Mental-health services in the camp are free and confidential. Counselling, support groups and medication are available — seeking help is a sign of strength, not weakness.',
      ],
      keyFacts: [
        'Talk to a counsellor — JRS and IRC offer free sessions.',
        'If you have thoughts of harming yourself, tell someone today.',
        'Children and adolescents need mental-health support too.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Mental health — health topic', url: 'https://www.who.int/health-topics/mental-health', description: 'WHO mental health programme and resources.' },
      { org: 'UNHCR', title: 'Mental health and psychosocial support', url: 'https://www.unhcr.org/what-we-do/protect-human-rights/public-health/mental-health-and-psychosocial-support', description: 'UNHCR MHPSS in refugee settings.' },
      { org: 'WHO', title: 'mhGAP humanitarian intervention guide', url: 'https://www.who.int/publications/i/item/9789241548922', description: 'Clinical management of mental conditions in emergencies.' },
    ],
  },
  {
    slug: 'first-aid',
    category: 'general',
    icon: '🩹',
    en: {
      title: 'First Aid Basics',
      body: 'Quick action in the first minutes can save a life.',
      details: [
        'Bleeding: press firmly on the wound with a clean cloth for 10 minutes without lifting. Elevate the limb if possible. Seek care if bleeding does not stop.',
        'Burns: cool with running water for 20 minutes. Do not apply oil, butter, or ice. Cover loosely with clean cloth and seek care for large or deep burns.',
        'Choking: encourage coughing. If they cannot breathe, give 5 back blows between the shoulder blades, then 5 abdominal thrusts (Heimlich). For infants, use back blows and chest thrusts.',
        'Snakebite: keep the person calm and still, immobilise the bitten limb, remove tight clothing/jewellery, and get to a clinic immediately. Do NOT cut the wound, suck venom, or apply ice.',
      ],
      keyFacts: [
        'Call for help first if someone is unresponsive.',
        'Wash your hands and use gloves if available.',
        'Never give food or water to an unconscious person.',
      ],
    },
    resources: [
      { org: 'IFRC', title: 'First aid', url: 'https://www.ifrc.org/our-work/health-and-care/first-aid', description: 'IFRC global first-aid guidelines and training.' },
      { org: 'WHO', title: 'Emergency care', url: 'https://www.who.int/health-topics/emergency-care', description: 'WHO emergency, trauma and acute care.' },
      { org: 'CDC', title: 'Emergency preparedness and response', url: 'https://emergency.cdc.gov/', description: 'CDC emergency response resources.' },
    ],
  },
  {
    slug: 'cholera',
    category: 'hygiene',
    icon: '⚠️',
    en: {
      title: 'Cholera: Act Fast',
      body: 'Severe watery diarrhoea can kill within hours — go to a clinic immediately.',
      details: [
        'Cholera causes profuse watery diarrhoea and vomiting that can lead to dehydration and death within hours if untreated. Outbreaks spread quickly through contaminated water and food.',
        'Treatment is simple and effective: oral rehydration solution for mild cases, intravenous fluids for severe cases. With prompt treatment, fewer than 1% of cases are fatal.',
        'Prevent cholera by drinking only safe water, washing hands with soap, eating fully-cooked food, using latrines, and getting the oral cholera vaccine when available.',
      ],
      keyFacts: [
        '"Rice-water" stools = suspect cholera, seek care now.',
        'Start ORS at home immediately on the way to the clinic.',
        'Wash hands after the toilet and before food.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Cholera — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/cholera', description: 'Symptoms, transmission, treatment and vaccine.' },
      { org: 'UNICEF', title: 'Cholera', url: 'https://www.unicef.org/health/cholera', description: 'UNICEF cholera response in emergencies.' },
      { org: 'MSF', title: 'Cholera', url: 'https://www.msf.org/cholera', description: 'MSF cholera treatment centres.' },
    ],
  },
  {
    slug: 'covid-19',
    category: 'general',
    icon: '😷',
    en: {
      title: 'COVID-19 & Respiratory Infections',
      body: 'Vaccinate, ventilate, and stay home when sick to protect your family.',
      details: [
        'COVID-19 and other respiratory infections (flu, RSV) spread through droplets and aerosols. Older adults, pregnant women, and people with chronic illness are most at risk of severe disease.',
        'Vaccination is the strongest protection against severe illness, hospitalisation and death. COVID-19 vaccines are free at public clinics.',
        'Other protections: open windows for ventilation, cover coughs and sneezes, wash hands often, wear a mask in crowded indoor spaces, and stay home if you have fever or cough.',
      ],
      keyFacts: [
        'Get vaccinated and boosted — it is free.',
        'Test if you have symptoms before visiting elderly relatives.',
        'Seek urgent care for difficulty breathing or chest pain.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Coronavirus disease (COVID-19)', url: 'https://www.who.int/health-topics/coronavirus', description: 'WHO COVID-19 information hub.' },
      { org: 'CDC', title: 'COVID-19', url: 'https://www.cdc.gov/coronavirus/2019-ncov/index.html', description: 'CDC COVID-19 resources.' },
      { org: 'UNICEF', title: 'COVID-19 vaccines', url: 'https://www.unicef.org/coronavirus/covid-19-vaccines', description: 'Vaccine equity and child health.' },
    ],
  },
  {
    slug: 'noncommunicable-diseases',
    category: 'general',
    icon: '❤️',
    en: {
      title: 'Diabetes, Hypertension & Heart Health',
      body: 'Check your blood pressure and blood sugar — early control prevents serious illness.',
      details: [
        'Noncommunicable diseases (NCDs) like high blood pressure, diabetes and heart disease are rising in refugee and host communities. Many people have them without symptoms until complications develop.',
        'Risk factors you can change: tobacco use, harmful alcohol, unhealthy diet (too much salt, sugar, processed food), physical inactivity, and being overweight.',
        'Free blood-pressure and blood-sugar checks are available at the clinic. If you are diagnosed, take medication every day as prescribed — even if you feel fine.',
      ],
      keyFacts: [
        'Adults should have BP checked at least once a year.',
        'Walk 30 minutes a day if you can.',
        'Reduce salt to less than one teaspoon per day.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Noncommunicable diseases', url: 'https://www.who.int/health-topics/noncommunicable-diseases', description: 'WHO NCD prevention and management.' },
      { org: 'WHO', title: 'Hypertension fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/hypertension', description: 'High blood pressure facts and prevention.' },
      { org: 'CDC', title: 'Diabetes basics', url: 'https://www.cdc.gov/diabetes/basics/', description: 'Types, symptoms, prevention.' },
    ],
  },
  {
    slug: 'gbv-support',
    category: 'general',
    icon: '🛡️',
    en: {
      title: 'Gender-Based Violence: Help is Available',
      body: 'You are not to blame. Free, confidential support exists.',
      details: [
        'Gender-based violence (GBV) includes physical, sexual, emotional and economic harm. It can affect anyone — women, men, girls and boys — and is never the survivor\'s fault.',
        'After sexual assault, seek medical care within 72 hours: post-exposure prophylaxis (PEP) can prevent HIV, emergency contraception can prevent pregnancy, and treatment for other infections is available.',
        'Confidential support — counselling, safe shelter, legal aid — is available from UNHCR, IRC, IRC GBV programme, and the Heshima Kenya safe house. Calling for help does not put your asylum status at risk.',
      ],
      keyFacts: [
        'GBV is a crime — survivors deserve dignity and care.',
        'Seek medical care within 72 hours after sexual violence.',
        'All services are free and confidential.',
      ],
    },
    resources: [
      { org: 'UNHCR', title: 'Sexual and gender-based violence', url: 'https://www.unhcr.org/what-we-do/protect-human-rights/protection/sexual-and-gender-based-violence', description: 'UNHCR GBV protection and response.' },
      { org: 'WHO', title: 'Violence against women', url: 'https://www.who.int/health-topics/violence-against-women', description: 'WHO health-sector response.' },
      { org: 'UNICEF', title: 'Gender-based violence in emergencies', url: 'https://www.unicef.org/protection/gender-based-violence-in-emergencies', description: 'Protecting children and adolescents.' },
    ],
  },
  {
    slug: 'oral-health',
    category: 'hygiene',
    icon: '🦷',
    en: {
      title: 'Healthy Teeth & Gums',
      body: 'Brush twice a day with fluoride toothpaste and limit sugary drinks.',
      details: [
        'Tooth decay and gum disease are among the most common health problems worldwide and are largely preventable. Untreated decay causes pain, infection and missed school.',
        'Brush teeth for 2 minutes morning and night with a fluoride toothpaste. A pea-sized amount is enough for children. Replace toothbrushes every 3 months or when bristles bend.',
        'Limit sugary drinks and sweets — especially between meals. Drink water instead. See a dental worker if you have pain, bleeding gums, or a swollen face.',
      ],
      keyFacts: [
        'Fluoride toothpaste prevents cavities — use it twice a day.',
        'Don\'t put a baby to bed with a bottle of milk or juice.',
        'A swollen face with toothache needs same-day care.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Oral health', url: 'https://www.who.int/health-topics/oral-health', description: 'WHO oral health programme.' },
      { org: 'CDC', title: 'Oral health basics', url: 'https://www.cdc.gov/oralhealth/basics/index.html', description: 'Tooth decay, gum disease, prevention.' },
    ],
  },
  {
    slug: 'adolescent-health',
    category: 'general',
    icon: '🧑‍🎓',
    en: {
      title: 'Adolescent Health & Wellbeing',
      body: 'Teenage years are a time of growth — eat well, stay active, get vaccines, ask questions.',
      details: [
        'Adolescents (ages 10–19) need extra nutrition, sleep (8–10 hours) and physical activity. Iron-rich foods are especially important for girls who menstruate.',
        'HPV vaccine for girls aged 9–14 prevents most cervical cancers. Tetanus boosters and a yearly check-up are also recommended.',
        'It is normal to have questions about puberty, relationships and emotions. Trusted adults, school nurses and youth-friendly clinic services can help — confidentially.',
      ],
      keyFacts: [
        'HPV vaccine: 1–2 doses prevents cervical cancer.',
        'Aim for 60 minutes of activity most days.',
        'Avoid tobacco, alcohol and other drugs.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Adolescent health', url: 'https://www.who.int/health-topics/adolescent-health', description: 'WHO adolescent and youth health programme.' },
      { org: 'UNICEF', title: 'Adolescents', url: 'https://www.unicef.org/adolescents', description: 'UNICEF adolescent development.' },
      { org: 'CDC', title: 'HPV vaccine', url: 'https://www.cdc.gov/hpv/parents/vaccine.html', description: 'About the HPV vaccine.' },
    ],
  },
  {
    slug: 'dehydration-signs',
    category: 'general',
    icon: '🥤',
    en: {
      title: 'Spotting Dehydration Early',
      body: 'Dry mouth, dark urine and dizziness mean you need fluids — now.',
      details: [
        'Dehydration happens fast in hot weather, during diarrhoea, vomiting or fever, and in young children and the elderly. Untreated, it can damage the kidneys and cause shock.',
        'Mild signs: thirst, dry mouth, dark yellow urine, headache and tiredness. Severe signs in a child: sunken eyes, no tears when crying, very slow skin pinch, no urine for 6 hours, unusual sleepiness — go to a clinic immediately.',
        'Treat with small sips of safe water, ORS, or clear broth. Avoid sugary sodas which can worsen diarrhoea.',
      ],
      keyFacts: [
        'Aim for pale-yellow urine — that means you are well hydrated.',
        'Give ORS, not plain water, when there is diarrhoea.',
        'Babies under 6 months: keep breastfeeding more often.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Diarrhoeal disease — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/diarrhoeal-disease', description: 'How dehydration develops and how to treat it.' },
      { org: 'CDC', title: 'Heat and your health', url: 'https://www.cdc.gov/disasters/extremeheat/', description: 'Recognising and preventing dehydration in heat.' },
    ],
  },
  {
    slug: 'typhoid',
    category: 'general',
    icon: '🌡️',
    en: {
      title: 'Typhoid Fever',
      body: 'High fever lasting more than 3 days with stomach pain — get tested.',
      details: [
        'Typhoid is caused by Salmonella Typhi bacteria spread through contaminated food and water. Without treatment, 1 in 5 cases is fatal.',
        'Symptoms develop slowly: persistent high fever, headache, weakness, stomach pain, constipation or diarrhoea, and sometimes a faint rash. A blood test confirms diagnosis.',
        'Treat with the antibiotics prescribed by a clinician — finish the full course. Prevent typhoid through safe water, hand-washing, food hygiene, and the typhoid vaccine where available.',
      ],
      keyFacts: [
        'Fever for more than 3 days = see a clinician.',
        'Wash fruits and vegetables with safe water before eating.',
        'Take antibiotics for the full prescribed period.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Typhoid — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/typhoid', description: 'Symptoms, prevention and vaccine.' },
      { org: 'CDC', title: 'Typhoid fever', url: 'https://www.cdc.gov/typhoid-fever/index.html', description: 'CDC typhoid information.' },
    ],
  },
  {
    slug: 'snake-bite',
    category: 'general',
    icon: '🐍',
    en: {
      title: 'Snake Bite First Aid',
      body: 'Stay calm, keep still, get to a clinic fast — do not cut or suck the wound.',
      details: [
        'Most snake bites in East Africa occur on the lower legs while walking at night. Some snakes are venomous, others are not — assume the worst and go to a clinic.',
        'First aid: keep the bitten person calm and as still as possible. Remove rings, watches, tight clothing. Immobilise the limb at heart level with a splint. Carry rather than walk if you can.',
        'Do NOT cut the wound, suck out venom, apply ice, give alcohol, or use traditional remedies that delay treatment. Antivenom and supportive care at a hospital save lives.',
      ],
      keyFacts: [
        'Wear closed shoes and use a torch at night.',
        'Try to remember the snake\'s colour and size — do not chase or kill it.',
        'Get to the nearest hospital within 1 hour if possible.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Snakebite envenoming', url: 'https://www.who.int/health-topics/snakebite-envenoming', description: 'WHO snakebite programme and guidelines.' },
      { org: 'MSF', title: 'Snakebite', url: 'https://www.msf.org/snakebite', description: 'MSF response to snakebite in Africa.' },
    ],
  },
  {
    slug: 'burns-care',
    category: 'general',
    icon: '🔥',
    en: {
      title: 'Burns: First Aid',
      body: 'Cool with running water for 20 minutes — never apply oil or butter.',
      details: [
        'Most burns in the home come from cooking fires, hot liquids and lamps. Quick action greatly reduces scarring and infection.',
        'Cool the burn with cool (not icy) running water for at least 20 minutes. Remove tight clothing and jewellery before swelling starts. Cover loosely with a clean, non-stick cloth.',
        'Seek care for: burns larger than the person\'s palm, burns on the face, hands, feet, joints or genitals, burns on a baby, deep burns, or any burn from electricity or chemicals.',
      ],
      keyFacts: [
        'Keep small children away from cooking areas.',
        'Never apply toothpaste, oil, butter or eggs.',
        'Pain killers like paracetamol are fine while you wait for care.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Burns — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/burns', description: 'Prevention and emergency care.' },
      { org: 'IFRC', title: 'First aid', url: 'https://www.ifrc.org/our-work/health-and-care/first-aid', description: 'IFRC global first-aid guidance.' },
    ],
  },
  {
    slug: 'heat-stroke',
    category: 'general',
    icon: '☀️',
    en: {
      title: 'Heat Stroke & Heat Exhaustion',
      body: 'Move to shade, cool the body, sip water — confusion is an emergency.',
      details: [
        'Hot, dry conditions in Turkana can cause heat exhaustion (heavy sweating, weakness, headache) which, if untreated, becomes heat stroke (high body temperature, confusion, possibly no sweating) — life-threatening.',
        'Move the person to shade or a cool room, loosen clothing, sponge with cool water, fan them, and offer small sips of water or ORS if conscious.',
        'Call for emergency care if there is confusion, fainting, vomiting, or body temperature feels very high. Children, elderly and people with chronic illness are most at risk.',
      ],
      keyFacts: [
        'Drink water regularly during hot days, even if not thirsty.',
        'Avoid hard outdoor work between 11am and 3pm.',
        'Never leave children inside parked vehicles.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Heat and health', url: 'https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health', description: 'Health impacts of heat and how to prepare.' },
      { org: 'CDC', title: 'Extreme heat', url: 'https://www.cdc.gov/disasters/extremeheat/', description: 'CDC extreme-heat health guide.' },
    ],
  },
  {
    slug: 'wound-care',
    category: 'general',
    icon: '🩹',
    en: {
      title: 'Cleaning a Wound at Home',
      body: 'Clean with soap and clean water, cover, and watch for infection.',
      details: [
        'Wash your hands first. Rinse the wound under running clean water for several minutes to remove dirt and germs. Wash gently around the wound with soap.',
        'Pat dry with a clean cloth, apply a thin layer of antiseptic if you have it, and cover with a clean bandage. Change the dressing daily or when wet/dirty.',
        'Watch for signs of infection: increasing redness, swelling, warmth, pus, or fever — go to a clinic if any appear. Tetanus vaccine is needed for dirty wounds if the last dose was over 5 years ago.',
      ],
      keyFacts: [
        'Bleeding: press firmly with a clean cloth for 10 minutes.',
        'Animal or human bite wounds always need clinic review.',
        'Keep the dressing dry; change daily.',
      ],
    },
    resources: [
      { org: 'IFRC', title: 'First aid', url: 'https://www.ifrc.org/our-work/health-and-care/first-aid', description: 'Wound care and bandaging.' },
      { org: 'WHO', title: 'Tetanus', url: 'https://www.who.int/health-topics/tetanus', description: 'Tetanus prevention and vaccination.' },
    ],
  },
  {
    slug: 'eye-health',
    category: 'general',
    icon: '👁️',
    en: {
      title: 'Eye Care & Trachoma',
      body: 'Wash the face daily, keep flies away, and seek care for red, painful eyes.',
      details: [
        'Trachoma is the leading infectious cause of blindness in dry, dusty regions. It spreads through contact with eye/nose discharge from infected children, often via flies.',
        'Prevent it with the SAFE strategy: Surgery for advanced cases, Antibiotics during community campaigns, Facial cleanliness daily, and Environmental improvements (latrines, water).',
        'Other red flags: sudden vision loss, eye injury, severe pain, or chemicals in the eye — these need same-day care. Children with squint or who sit very close to objects may need glasses.',
      ],
      keyFacts: [
        'Wash children\'s faces with soap and water every day.',
        'Never put traditional medicine into the eyes.',
        'A child who fails to read the blackboard should have an eye check.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Trachoma — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/trachoma', description: 'Disease, transmission and SAFE strategy.' },
      { org: 'WHO', title: 'Blindness and vision impairment', url: 'https://www.who.int/news-room/fact-sheets/detail/blindness-and-visual-impairment', description: 'Causes and prevention.' },
    ],
  },
  {
    slug: 'ear-infections',
    category: 'general',
    icon: '👂',
    en: {
      title: 'Ear Pain & Infections',
      body: 'Ear pain in a child is common — but discharge or hearing loss needs a clinician.',
      details: [
        'Middle-ear infections often follow colds in young children. Most clear within a few days, but some need antibiotics.',
        'Warning signs: ear discharge, fever, hearing difficulty, severe pain, or pulling at the ear in a baby. Untreated infections can damage hearing or spread to nearby tissues.',
        'Never put sticks, cotton buds, leaves or oil into the ear — this can push wax in deeper or rupture the eardrum. Keep ears dry when bathing if there is discharge.',
      ],
      keyFacts: [
        'Pain relief: paracetamol at the right dose for age.',
        'Discharge for more than a day = clinic visit.',
        'Babies cry, pull the ear, and may not feed well.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Deafness and hearing loss', url: 'https://www.who.int/news-room/fact-sheets/detail/deafness-and-hearing-loss', description: 'Causes and prevention of hearing loss.' },
    ],
  },
  {
    slug: 'scabies',
    category: 'hygiene',
    icon: '🪲',
    en: {
      title: 'Scabies & Itchy Skin',
      body: 'Tiny mites cause intense itching — the whole household must be treated together.',
      details: [
        'Scabies is a very itchy skin condition caused by tiny mites that burrow into the skin. It spreads easily through close skin-to-skin contact and shared bedding/clothing.',
        'Itching is worse at night. A rash or small bumps appear between fingers, on wrists, in armpits, around the waist and on the genitals.',
        'Treatment is a permethrin or benzyl benzoate cream applied from neck to toes (or ivermectin tablets in some cases). Treat ALL household members the same day, and wash all clothes and bedding in hot water.',
      ],
      keyFacts: [
        'Treat the whole household together — even those without itching.',
        'Wash clothes and bedding in hot water and sun-dry.',
        'Itching may continue for 2 weeks after successful treatment.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Scabies', url: 'https://www.who.int/news-room/fact-sheets/detail/scabies', description: 'WHO scabies fact sheet.' },
      { org: 'CDC', title: 'Scabies', url: 'https://www.cdc.gov/parasites/scabies/', description: 'Diagnosis and treatment.' },
    ],
  },
  {
    slug: 'menstrual-hygiene',
    category: 'hygiene',
    icon: '🌸',
    en: {
      title: 'Menstrual Health & Hygiene',
      body: 'Periods are normal — manage them safely with clean materials and privacy.',
      details: [
        'Menstruation is a normal part of life from around age 10–15 to age 45–55. Girls and women need clean, private spaces, water and sanitary materials to manage periods with dignity.',
        'Change pads or cloths every 4–6 hours. Wash reusable cloths with soap and clean water and dry them in the sun (sunlight kills germs). Wash hands before and after.',
        'See a clinician if periods are very heavy (soaking through pads in 1 hour), very painful, last more than 7 days, stop suddenly outside pregnancy, or come with fever.',
      ],
      keyFacts: [
        'Pads and reusable cloths are both safe — choose what works.',
        'Pain relief like paracetamol or ibuprofen helps cramps.',
        'Periods missing for more than 6 weeks: do a pregnancy test or see a clinician.',
      ],
    },
    resources: [
      { org: 'UNICEF', title: 'Menstrual hygiene', url: 'https://www.unicef.org/wash/menstrual-hygiene', description: 'UNICEF MHM in schools and emergencies.' },
      { org: 'WHO', title: 'Sexual and reproductive health', url: 'https://www.who.int/health-topics/sexual-and-reproductive-health-and-rights', description: 'WHO SRHR programme.' },
    ],
  },
  {
    slug: 'cervical-cancer',
    category: 'maternal',
    icon: '🎀',
    en: {
      title: 'Cervical Cancer Screening',
      body: 'Free screening every 3–5 years saves lives — book an appointment today.',
      details: [
        'Cervical cancer is one of the most common cancers in women in sub-Saharan Africa, but it is highly preventable through HPV vaccination of girls and regular screening of women aged 30–49.',
        'Screening is quick (visual inspection with acetic acid or HPV test) and treatment of early changes is simple. Without screening, cervical cancer often presents late, when treatment is harder.',
        'Get screened every 3 years if HIV-negative, or every year if living with HIV. Symptoms that need urgent review: bleeding between periods or after sex, foul-smelling discharge, or pelvic pain.',
      ],
      keyFacts: [
        'HPV vaccine for girls aged 9–14 prevents most cases.',
        'Screening is free at IRC and AMREF clinics.',
        'Early treatment is highly effective.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Cervical cancer', url: 'https://www.who.int/health-topics/cervical-cancer', description: 'Global elimination strategy and guidelines.' },
      { org: 'WHO', title: 'HPV vaccination', url: 'https://www.who.int/news-room/fact-sheets/detail/human-papillomavirus-(hpv)-and-cervical-cancer', description: 'Vaccine recommendations.' },
    ],
  },
  {
    slug: 'breast-self-exam',
    category: 'maternal',
    icon: '🌷',
    en: {
      title: 'Know Your Breasts',
      body: 'Get used to how your breasts feel — tell a clinician about any new lump.',
      details: [
        'Breast cancer can affect women (and rarely men) of any age. Detecting changes early greatly improves treatment outcomes.',
        'Once a month, after your period, look at and feel both breasts and armpits. Note any new lumps, dimpling, nipple discharge, change in size or shape, or skin changes.',
        'Most lumps are not cancer — but every new, persistent lump should be examined by a clinician. Free clinical breast exams are part of routine reproductive-health visits.',
      ],
      keyFacts: [
        'Examine both breasts the same way each month.',
        'A new lump that lasts more than 2 weeks needs a clinician.',
        'Breastfeeding reduces breast cancer risk for the mother.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Breast cancer', url: 'https://www.who.int/news-room/fact-sheets/detail/breast-cancer', description: 'Risk factors, signs and early detection.' },
    ],
  },
  {
    slug: 'postnatal-care',
    category: 'maternal',
    icon: '👶',
    en: {
      title: 'Postnatal Care for Mother & Baby',
      body: 'Both mother and newborn need at least 4 check-ups in the 6 weeks after birth.',
      details: [
        'The first 6 weeks after birth are the highest-risk period for newborn deaths and serious maternal complications. WHO recommends postnatal contacts on day 1, day 3, between days 7–14, and at 6 weeks.',
        'Mother: check for bleeding, infection, blood pressure, mood (look out for postnatal depression), breastfeeding support, and family-planning counselling.',
        'Baby: check breathing, weight, jaundice, cord care, feeding, and BCG and polio vaccinations. Keep the baby warm with skin-to-skin contact.',
      ],
      keyFacts: [
        'Heavy bleeding, fever or smelly discharge = clinic now.',
        'Baby not feeding, very sleepy, or yellow eyes = clinic now.',
        'Plan family planning before resuming sex.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Postnatal care recommendations', url: 'https://www.who.int/publications/i/item/9789240045989', description: '2022 WHO postnatal care guidance.' },
      { org: 'UNICEF', title: 'Maternal and newborn health', url: 'https://www.unicef.org/health/maternal-and-newborn-health', description: 'UNICEF programmes for mothers and newborns.' },
    ],
  },
  {
    slug: 'newborn-care',
    category: 'maternal',
    icon: '🍼',
    en: {
      title: 'Caring for a Newborn',
      body: 'Keep warm, breastfeed early, keep the cord clean, and watch for danger signs.',
      details: [
        'In the first hours: dry the baby, place skin-to-skin on mother\'s chest, breastfeed within 1 hour, delay the first bath for at least 24 hours, and apply chlorhexidine to the cord stump (where recommended).',
        'Keep the baby warm — small babies lose heat quickly. Wrap in a clean cloth and a hat. Avoid putting babies on cold surfaces.',
        'Danger signs: not feeding, fast or difficult breathing, fever or feeling cold, yellow eyes/skin, convulsions, very sleepy or floppy. Any of these = go to clinic immediately.',
      ],
      keyFacts: [
        'Skin-to-skin (kangaroo care) keeps small babies warm and stable.',
        'No water, tea or other foods before 6 months — only breast milk.',
        'Sleep the baby on the back, not face-down.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Newborn health', url: 'https://www.who.int/health-topics/newborn-health', description: 'Essential newborn care and resources.' },
      { org: 'UNICEF', title: 'Maternal and newborn health', url: 'https://www.unicef.org/health/maternal-and-newborn-health', description: 'UNICEF newborn health programmes.' },
    ],
  },
  {
    slug: 'complementary-feeding',
    category: 'nutrition',
    icon: '🥣',
    en: {
      title: 'Feeding Babies After 6 Months',
      body: 'Continue breastfeeding and add safe, soft, varied family foods.',
      details: [
        'From 6 months, breast milk alone is not enough. Babies need additional foods (complementary feeding) while still being breastfed up to 2 years or beyond.',
        'Start with soft, mashed foods 2–3 times a day at 6–8 months, increasing to 3–4 meals plus snacks by 9–24 months. Include cereals, beans, eggs, fish, meat, milk, fruits and vegetables.',
        'Add a small amount of oil or groundnut paste for energy. Always wash hands and feed the baby with a clean spoon and bowl. Avoid sugary drinks, sweets and salty snacks.',
      ],
      keyFacts: [
        'A teaspoon of oil per meal boosts energy for growing babies.',
        'Iron-rich foods (beans, eggs, liver) prevent anaemia.',
        'Be patient — new tastes may need 8–10 tries to be accepted.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Infant and young child feeding', url: 'https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding', description: 'Feeding recommendations 0–24 months.' },
      { org: 'UNICEF', title: 'Complementary feeding', url: 'https://www.unicef.org/nutrition/complementary-feeding', description: 'UNICEF guidance for caregivers.' },
    ],
  },
  {
    slug: 'vitamin-a',
    category: 'nutrition',
    icon: '🥕',
    en: {
      title: 'Vitamin A for Children',
      body: 'Two doses a year prevent blindness and serious infections in young children.',
      details: [
        'Vitamin A deficiency increases the risk of measles, diarrhoea, blindness and death in young children. Vitamin A supplementation is one of the most cost-effective child-survival interventions.',
        'Children aged 6–59 months should receive a vitamin A capsule every 6 months. Capsules are given free during child-health days at clinics and outreach posts.',
        'Food sources: dark green leafy vegetables, orange fruits and vegetables (mango, pawpaw, carrot, sweet potato), eggs, liver, fortified oil and milk.',
      ],
      keyFacts: [
        'Two doses a year, every year until age 5.',
        'Bring the child\'s health card to receive the supplement.',
        'Eat orange and dark-green vegetables when in season.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Vitamin A supplementation', url: 'https://www.who.int/tools/elena/interventions/vitamina-children', description: 'WHO eLENA recommendations.' },
      { org: 'UNICEF', title: 'Vitamin A', url: 'https://www.unicef.org/nutrition/vitamin-a-deficiency', description: 'UNICEF vitamin A programmes.' },
    ],
  },
  {
    slug: 'food-safety',
    category: 'hygiene',
    icon: '🍲',
    en: {
      title: 'Safe Food at Home',
      body: 'Keep food clean, cooked, and covered to prevent diarrhoea.',
      details: [
        'Five keys to safer food (WHO): keep clean, separate raw and cooked, cook thoroughly, keep food at safe temperatures, and use safe water and raw materials.',
        'Wash hands before preparing food and between handling raw meat and other foods. Use separate boards/knives if possible. Cook meat, poultry and eggs until juices run clear.',
        'Do not leave cooked food at room temperature for more than 2 hours. Reheat leftovers thoroughly. Cover food to keep flies away.',
      ],
      keyFacts: [
        'Wash fruit and vegetables with safe water before eating.',
        'Throw away food that smells off or is past its date.',
        'Use clean utensils and cover stored food.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Food safety', url: 'https://www.who.int/news-room/fact-sheets/detail/food-safety', description: 'Five keys to safer food.' },
      { org: 'CDC', title: 'Food safety', url: 'https://www.cdc.gov/foodsafety/', description: 'CDC food-safety guidance.' },
    ],
  },
  {
    slug: 'latrine-use',
    category: 'hygiene',
    icon: '🚽',
    en: {
      title: 'Use a Latrine — Keep It Clean',
      body: 'Latrines protect everyone from diarrhoea and worms.',
      details: [
        'Open defecation contaminates soil and water and causes outbreaks. Use a latrine every time, including at night and when away from home.',
        'Keep latrines clean: cover the hole between uses, sweep daily, scrub with soap and water weekly, and ensure a tight-fitting door for privacy and safety.',
        'Wash hands with soap after using the latrine and before eating or feeding a child. Bury or dispose of children\'s faeces in the latrine.',
      ],
      keyFacts: [
        'Even small babies\' stools must go in the latrine.',
        'A hand-wash station with soap is essential next to the latrine.',
        'Report broken or unsafe latrines to your block leader or WASH team.',
      ],
    },
    resources: [
      { org: 'UNICEF', title: 'Sanitation', url: 'https://www.unicef.org/wash/sanitation', description: 'UNICEF sanitation programmes.' },
      { org: 'WHO', title: 'Sanitation — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/sanitation', description: 'Health benefits of sanitation.' },
    ],
  },
  {
    slug: 'tobacco-cessation',
    category: 'general',
    icon: '🚭',
    en: {
      title: 'Quitting Tobacco',
      body: 'It is never too late to quit — your lungs start healing within weeks.',
      details: [
        'Tobacco kills more than 8 million people every year worldwide. It causes cancers, heart disease, stroke, lung disease, and complications in pregnancy.',
        'Within hours of quitting, blood pressure drops. Within weeks, lung function improves. Within years, the risk of heart disease and cancer falls toward that of a non-smoker.',
        'Quitting is hard — most people try several times. Set a quit date, tell family and friends, identify triggers, and ask a clinician about counselling and (where available) nicotine replacement.',
      ],
      keyFacts: [
        'Second-hand smoke harms children and pregnant women.',
        'Chewing tobacco and shisha are also harmful.',
        'Free cessation counselling is available at IRC clinics.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Tobacco — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/tobacco', description: 'Global tobacco facts and quit support.' },
      { org: 'CDC', title: 'How to quit smoking', url: 'https://www.cdc.gov/tobacco/quit_smoking/index.htm', description: 'CDC quit-smoking resources.' },
    ],
  },
  {
    slug: 'alcohol-use',
    category: 'general',
    icon: '🍷',
    en: {
      title: 'Alcohol & Your Health',
      body: 'There is no safe level — less is always better, especially in pregnancy.',
      details: [
        'Alcohol contributes to injuries, violence, liver disease, mental-health problems, cancers and birth defects. Home-brewed drinks can also contain dangerous methanol.',
        'No amount of alcohol is safe in pregnancy — it can cause foetal alcohol spectrum disorders, lifelong learning and behaviour problems.',
        'Signs of harmful drinking: needing to drink in the morning, missing work or family obligations, blackouts, or feeling unable to stop. Counselling and peer support help.',
      ],
      keyFacts: [
        'Never drink and drive (or operate machinery).',
        'Pregnant or breastfeeding: zero alcohol.',
        'Free, confidential counselling is available at JRS.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Alcohol — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/alcohol', description: 'Health effects of alcohol.' },
      { org: 'CDC', title: 'Alcohol use', url: 'https://www.cdc.gov/alcohol/index.htm', description: 'CDC alcohol and public health.' },
    ],
  },
  {
    slug: 'road-safety',
    category: 'general',
    icon: '🚧',
    en: {
      title: 'Staying Safe on the Road',
      body: 'Helmets, seatbelts and safe walking save lives — every trip.',
      details: [
        'Road traffic injuries are a leading cause of death for young people aged 5–29. Most are preventable through safer behaviours and infrastructure.',
        'Always wear a helmet on a motorbike or bicycle (passengers too). Use seatbelts when available. Never travel with a driver who has been drinking.',
        'Walk on the side of the road facing oncoming traffic, wear bright/reflective clothes at night, and supervise young children near roads.',
      ],
      keyFacts: [
        'A helmet reduces fatal head injury by ~40%.',
        'Avoid using a phone while walking near roads.',
        'For long journeys, take rest breaks every 2 hours.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Road traffic injuries', url: 'https://www.who.int/news-room/fact-sheets/detail/road-traffic-injuries', description: 'Global facts and prevention.' },
      { org: 'UNICEF', title: 'Child injury prevention', url: 'https://www.unicef.org/protection/violence-against-children', description: 'Keeping children safe.' },
    ],
  },
  {
    slug: 'asthma',
    category: 'general',
    icon: '💨',
    en: {
      title: 'Living with Asthma',
      body: 'Use your inhaler correctly and avoid triggers — most attacks are preventable.',
      details: [
        'Asthma causes the airways to narrow, making it hard to breathe. Common triggers: smoke, dust, cold air, strong smells, pollen, exercise, and respiratory infections.',
        'Most people use two inhalers: a preventer (taken every day even when well) and a reliever (taken during an attack). Using a spacer helps the medicine reach the lungs.',
        'Severe attack signs: cannot speak in full sentences, lips/tongue blue, reliever not helping, very fast breathing or exhausted — call for emergency care immediately.',
      ],
      keyFacts: [
        'Take preventer inhaler EVERY day, even when feeling well.',
        'Avoid cooking smoke and tobacco smoke at home.',
        'Carry the reliever inhaler with you at all times.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Asthma — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/asthma', description: 'Diagnosis, treatment and prevention.' },
      { org: 'CDC', title: 'Asthma', url: 'https://www.cdc.gov/asthma/', description: 'CDC asthma resources.' },
    ],
  },
  {
    slug: 'epilepsy',
    category: 'general',
    icon: '⚡',
    en: {
      title: 'Epilepsy: Stigma-Free Care',
      body: 'Epilepsy is treatable. People with epilepsy live full, productive lives.',
      details: [
        'Epilepsy causes recurring seizures. It is NOT contagious and not caused by curses or spirits. Common causes include head injury, infections (like meningitis), or unknown reasons.',
        'During a seizure: stay calm, lay the person on their side, protect the head, do NOT put anything in the mouth, time the seizure. Get help if it lasts more than 5 minutes or repeats.',
        'Daily medication controls seizures in 70% of people. Take every dose, every day. Avoid triggers like missed sleep, alcohol, and missed meals.',
      ],
      keyFacts: [
        'Treatment is free at the mental-health unit (JRS, Kakuma 3).',
        'Cooking over fires can be dangerous — sit, don\'t stand.',
        'Swimming alone is risky — always go with someone.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Epilepsy — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/epilepsy', description: 'Causes, treatment, and stigma.' },
    ],
  },
  {
    slug: 'malnutrition-screening',
    category: 'nutrition',
    icon: '📏',
    en: {
      title: 'Spotting Malnutrition Early',
      body: 'A MUAC tape on a child\'s arm tells you if they need urgent feeding support.',
      details: [
        'Acute malnutrition can develop quickly during illness, food shortages, or after a long journey. Catching it early prevents death.',
        'Mid-upper arm circumference (MUAC) tape is used in children 6–59 months: green = healthy, yellow = at risk (moderate), red = severe acute malnutrition (life-threatening). Bring red/yellow children to clinic the same day.',
        'Other signs: visible wasting (ribs showing), swelling of feet (oedema), persistent loss of appetite, very weak or sleepy. Treatment with ready-to-use therapeutic food (RUTF) is highly effective.',
      ],
      keyFacts: [
        'Free RUTF treatment is available at all health posts.',
        'Continue breastfeeding throughout treatment.',
        'Pregnant women losing weight should also seek nutrition support.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Malnutrition — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/malnutrition', description: 'Forms, causes and treatment.' },
      { org: 'UNICEF', title: 'Severe acute malnutrition', url: 'https://data.unicef.org/topic/nutrition/malnutrition/', description: 'UNICEF data and programmes.' },
    ],
  },
  {
    slug: 'sti-prevention',
    category: 'general',
    icon: '💞',
    en: {
      title: 'Sexually Transmitted Infections',
      body: 'STIs are common and treatable — early care prevents complications.',
      details: [
        'STIs include gonorrhoea, syphilis, chlamydia, trichomoniasis, hepatitis B, HPV and HIV. Many cause no symptoms for weeks or months but can lead to infertility, cancer or pregnancy complications.',
        'Symptoms to watch for: discharge from the penis or vagina, sores, painful urination, lower abdominal pain, painful sex, or unusual rashes.',
        'Treatment is free and confidential. Both partners must be treated to prevent re-infection. Condoms used correctly and consistently prevent most STIs.',
      ],
      keyFacts: [
        'Get tested at least once a year if sexually active.',
        'Hepatitis B vaccine prevents one major STI.',
        'Bring your partner for treatment too.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Sexually transmitted infections', url: 'https://www.who.int/news-room/fact-sheets/detail/sexually-transmitted-infections-(stis)', description: 'WHO STI fact sheet.' },
      { org: 'CDC', title: 'STI basics', url: 'https://www.cdc.gov/std/general/default.htm', description: 'CDC STI information.' },
    ],
  },
  {
    slug: 'safe-sleep-baby',
    category: 'maternal',
    icon: '🛏️',
    en: {
      title: 'Safe Sleep for Babies',
      body: 'On the back, on a firm surface, with no loose bedding — every sleep.',
      details: [
        'Sudden infant death syndrome (SIDS) and sleep accidents are leading causes of unexpected baby deaths in the first year. Safe sleep practices reduce this risk.',
        'Always place the baby on the back to sleep, not the side or stomach. Use a firm, flat surface. Keep soft toys, pillows and loose bedding out of the sleep area.',
        'Share the room (not the bed) for the first 6 months. Avoid overheating — one extra layer than an adult would wear is enough. Do not let anyone smoke near the baby.',
      ],
      keyFacts: [
        'Back to sleep — every nap, every night.',
        'No pillows, blankets or toys in the cot.',
        'Breastfeeding reduces SIDS risk.',
      ],
    },
    resources: [
      { org: 'CDC', title: 'Safe sleep', url: 'https://www.cdc.gov/sids/parents-caregivers.htm', description: 'Safe sleep recommendations.' },
      { org: 'UNICEF', title: 'Newborn care', url: 'https://www.unicef.org/parenting/baby/sleep', description: 'UNICEF baby sleep guidance.' },
    ],
  },
  {
    slug: 'community-health-workers',
    category: 'general',
    icon: '🤝',
    en: {
      title: 'Your Community Health Worker',
      body: 'CHWs are trained neighbours who can help with check-ups, referrals and advice.',
      details: [
        'Community health workers (CHWs) live and work in the camp. They make home visits, check children\'s growth, refer the sick, support pregnant women, and help with referrals to clinics and hospitals.',
        'CHWs work for free — never pay them for services. They can give advice on family planning, nutrition, hygiene and chronic-disease care, and help link you to mental-health support.',
        'Ask your block leader for the name and phone number of your CHW. They can also help with this AfyaConnect app if you have trouble using it.',
      ],
      keyFacts: [
        'CHW services are FREE — never pay them.',
        'They can come to your home — useful for elderly or disabled.',
        'Tell your CHW if a neighbour is very sick at home.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Community health workers', url: 'https://www.who.int/teams/health-workforce/community-health-workers', description: 'WHO CHW programme.' },
      { org: 'UNHCR', title: 'Public health in refugee settings', url: 'https://www.unhcr.org/what-we-do/build-better-futures/public-health', description: 'UNHCR community health programmes.' },
    ],
  },
  {
    slug: 'physical-activity',
    category: 'general',
    icon: '🏃',
    en: {
      title: 'Move More, Sit Less',
      body: '30 minutes of activity most days protects your heart, mind and weight.',
      details: [
        'Regular activity reduces the risk of heart disease, diabetes, depression, stroke and some cancers, and helps you sleep better and manage stress.',
        'Adults need 150–300 minutes of moderate activity (like brisk walking) per week. Children need 60 minutes of activity most days. Anything that gets the heart working counts: walking, dancing, fetching water, gardening, sports.',
        'Start small if you are out of practice. Add 10 minutes a day until you reach the target. Stretch your body daily and avoid sitting for long periods without standing up.',
      ],
      keyFacts: [
        'Walking is free, safe, and works for almost everyone.',
        'Movement helps the mind too — reduces anxiety and low mood.',
        'Drink water before, during and after activity.',
      ],
    },
    resources: [
      { org: 'WHO', title: 'Physical activity — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity', description: 'Recommendations by age.' },
      { org: 'CDC', title: 'Physical activity basics', url: 'https://www.cdc.gov/physicalactivity/basics/index.htm', description: 'How much activity you need.' },
    ],
  },
  {
    slug: 'sleep-health',
    category: 'general',
    icon: '😴',
    en: {
      title: 'Sleep & Your Health',
      body: 'Adults need 7–9 hours; children and teens need more — protect your sleep.',
      details: [
        'Good sleep boosts the immune system, supports memory and mood, and lowers the risk of heart disease and diabetes. Long-term poor sleep is linked to depression and accidents.',
        'Build a routine: go to bed and wake up around the same time every day, even on weekends. Avoid heavy meals, caffeine and screens close to bedtime. Keep the sleeping area dark, cool and quiet if possible.',
        'See a clinician if you snore loudly with pauses in breathing, fall asleep during the day, or cannot sleep most nights for more than 2 weeks — these are treatable conditions.',
      ],
      keyFacts: [
        'Children 6–12: 9–12 hours. Teens: 8–10 hours.',
        'Daytime naps under 30 minutes can refresh without harming night sleep.',
        'A consistent bedtime helps more than long sleep-ins.',
      ],
    },
    resources: [
      { org: 'CDC', title: 'Sleep and sleep disorders', url: 'https://www.cdc.gov/sleep/index.html', description: 'CDC sleep recommendations and tips.' },
      { org: 'WHO', title: 'Mental health and sleep', url: 'https://www.who.int/health-topics/mental-health', description: 'Mental health resources including sleep.' },
    ],
  },
];

// Title + body translations only
const TRANSLATIONS = {
  sw: {
    'hand-washing': ['Kunawa Mikono Huokoa Maisha', 'Nawa mikono kwa sabuni kwa sekunde 20 kabla ya kula na baada ya choo.'],
    'safe-water': ['Maji Salama ya Kunywa', 'Chemsha au safisha maji kabla ya kunywa, hasa wakati wa mlipuko wa magonjwa.'],
    'balanced-meals': ['Mlo Kamili', 'Changanya nafaka, protini (maharagwe/nyama), na mboga katika kila mlo.'],
    'breastfeeding': ['Kunyonyesha', 'Kunyonyesha pekee kwa miezi 6 ya kwanza humlinda mtoto.'],
    'antenatal-care': ['Kliniki za Wajawazito', 'Hudhuria angalau ziara 4 za kliniki wakati wa ujauzito.'],
    'iron-folic-acid': ['Madini ya Chuma na Folic Acid', 'Tumia vidonge vya ujauzito kila siku kuzuia upungufu wa damu.'],
    'childhood-vaccines': ['Chanja Watoto Wako', 'Chanjo huzuia surua, polio, na magonjwa mengine hatari.'],
    'malaria-prevention': ['Lala Chini ya Chandarua', 'Tumia chandarua kila usiku kuzuia malaria.'],
  },
  fr: {
    'hand-washing': ['Le Lavage des Mains Sauve des Vies', 'Lavez-vous les mains au savon pendant au moins 20 secondes.'],
    'safe-water': ['Eau Potable Sûre', 'Faites bouillir ou traitez l\'eau avant de boire, surtout en cas d\'épidémie.'],
    'balanced-meals': ['Repas Équilibrés', 'Combinez céréales, protéines et légumes à chaque repas.'],
    'breastfeeding': ['Allaitement', 'L\'allaitement exclusif pendant 6 mois protège le nourrisson.'],
    'antenatal-care': ['Visites Prénatales', 'Assistez à au moins 4 consultations prénatales.'],
    'iron-folic-acid': ['Fer et Acide Folique', 'Prenez les suppléments quotidiennement pour éviter l\'anémie.'],
    'childhood-vaccines': ['Vaccinez vos Enfants', 'Les vaccins préviennent la rougeole, la polio et autres maladies.'],
    'malaria-prevention': ['Dormez Sous une Moustiquaire', 'Utilisez une moustiquaire traitée chaque nuit contre le paludisme.'],
  },
  ar: {
    'hand-washing': ['غسل اليدين ينقذ الأرواح', 'اغسل يديك بالصابون لمدة 20 ثانية قبل الأكل وبعد الحمام.'],
    'safe-water': ['مياه شرب آمنة', 'اغل الماء أو عالجه قبل الشرب، خاصة أثناء تفشي الأمراض.'],
    'balanced-meals': ['وجبات متوازنة', 'اجمع بين الحبوب والبروتينات والخضروات في كل وجبة.'],
    'breastfeeding': ['الرضاعة الطبيعية', 'الرضاعة الطبيعية الحصرية لمدة 6 أشهر تحمي الرضيع.'],
    'antenatal-care': ['زيارات ما قبل الولادة', 'احضري 4 فحوصات على الأقل أثناء الحمل.'],
    'iron-folic-acid': ['الحديد وحمض الفوليك', 'تناولي المكملات يومياً للوقاية من فقر الدم.'],
    'childhood-vaccines': ['طعّم أطفالك', 'اللقاحات تقي من الحصبة وشلل الأطفال وأمراض أخرى.'],
    'malaria-prevention': ['نم تحت ناموسية', 'استخدم ناموسية معالجة كل ليلة للوقاية من الملاريا.'],
  },
};

async function run() {
  await connectDb();
  console.log('[seed] refreshing reference data (ALL users preserved)...');
  // Never wipe users. Re-seed only refreshes clinics, education content
  // and seeded notifications.
  await Promise.all([
    Clinic.deleteMany({}),
    EducationContent.deleteMany({}),
    Notification.deleteMany({ type: { $in: ['campaign', 'alert'] } }),
  ]);

  console.log('[seed] creating clinics...');
  await Clinic.insertMany(
    CLINICS.map((c) => ({
      name: c.name,
      address: c.address,
      services: c.services,
      hours: c.hours,
      avgServiceMinutes: c.avgServiceMinutes,
      location: { type: 'Point', coordinates: [c.lng, c.lat] },
    }))
  );

  console.log('[seed] ensuring admin user exists (existing password preserved)...');
  const existingAdmin = await User.findOne({ phone: config.admin.phone });
  if (!existingAdmin) {
    const adminHash = await bcrypt.hash(config.admin.password, 12);
    await User.create({
      phone: config.admin.phone,
      passwordHash: adminHash,
      name: config.admin.name,
      role: 'admin',
      language: 'en',
    });
    console.log('[seed]   admin created.');
  } else {
    // Make sure the role is still admin, but DO NOT touch the password.
    if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      await existingAdmin.save();
    }
    console.log('[seed]   admin already exists — password kept as-is.');
  }

  console.log('[seed] creating education content...');
  const docs = [];
  for (const topic of TOPICS) {
    // English (canonical with full details + resources)
    docs.push({
      slug: topic.slug,
      category: topic.category,
      icon: topic.icon,
      language: 'en',
      title: topic.en.title,
      body: topic.en.body,
      details: topic.en.details,
      keyFacts: topic.en.keyFacts,
      resources: topic.resources,
    });
    // Translated variants share the same slug; details/facts/resources reused
    for (const lang of ['sw', 'fr', 'ar']) {
      const tr = TRANSLATIONS[lang][topic.slug];
      if (!tr) continue;
      docs.push({
        slug: topic.slug,
        category: topic.category,
        icon: topic.icon,
        language: lang,
        title: tr[0],
        body: tr[1],
        details: topic.en.details,
        keyFacts: topic.en.keyFacts,
        resources: topic.resources,
      });
    }
  }
  await EducationContent.insertMany(docs);

  console.log('[seed] creating health announcements...');
  // Latest health-care announcements relevant to Kakuma & Kalobeyei.
  // Spread `createdAt` over the last few weeks so the dashboard shows a fresh feed.
  const now = Date.now();
  const daysAgo = (n) => new Date(now - n * 86400_000);
  const ANNOUNCEMENTS = [
    {
      type: 'campaign',
      title: 'Measles & Rubella Vaccination Drive — All Camps',
      message:
        'Free measles & rubella vaccination for children aged 9 months to 15 years this Saturday, 9am–4pm at Amusait Hospital, Kalobeyei Main Health Centre and all Health Posts. Bring the child\'s vaccination card.',
      audience: 'all',
      createdAt: daysAgo(0),
    },
    {
      type: 'alert',
      title: 'Cholera Alert — Boil All Drinking Water',
      message:
        'Suspected cholera cases reported in Kakuma 2. Boil drinking water for at least 1 minute, wash hands with soap, and seek care immediately for severe watery diarrhoea. Free ORS available at all clinics.',
      audience: 'all',
      createdAt: daysAgo(1),
    },
    {
      type: 'campaign',
      title: 'Free Antenatal Care Day — Pregnant Women',
      message:
        'IRC and AMREF are hosting a free antenatal clinic every Tuesday at Kalobeyei Main Health Centre and Nalemsekon Health Post. Includes ultrasound, iron-folic acid supplements and HIV testing.',
      audience: 'all',
      createdAt: daysAgo(2),
    },
    {
      type: 'campaign',
      title: 'HPV Vaccination — Girls Aged 9 to 14',
      message:
        'Two-dose HPV vaccine to protect against cervical cancer is now available free at Amusait Hospital, Kakuma Mission Hospital and Kalobeyei Main. Parents can book a slot through this app.',
      audience: 'all',
      createdAt: daysAgo(3),
    },
    {
      type: 'alert',
      title: 'Heatwave Advisory — Stay Hydrated',
      message:
        'Temperatures expected above 38°C across Turkana this week. Drink safe water often, keep children and elderly in shade, and avoid heavy work in midday sun. Seek care for dizziness or fainting.',
      audience: 'all',
      createdAt: daysAgo(4),
    },
    {
      type: 'campaign',
      title: 'World TB Day — Free Screening Week',
      message:
        'Persistent cough longer than 2 weeks? Get a FREE tuberculosis screening at the TB & HIV Care Centre (Kakuma 1). Treatment is also free and lasts 6 months. Walk-ins welcome 8am–5pm.',
      audience: 'all',
      createdAt: daysAgo(5),
    },
    {
      type: 'campaign',
      title: 'Family Planning Counselling — All Methods Free',
      message:
        'Confidential family planning services every Wednesday at AMREF Reproductive Health Clinic, Kakuma 3. Includes pills, injections, implants, IUDs and condoms — all free of charge.',
      audience: 'all',
      createdAt: daysAgo(6),
    },
    {
      type: 'alert',
      title: 'Malaria Cases Rising — Use Your ITN Every Night',
      message:
        'Increased malaria cases reported in Kalobeyei Village 2. Sleep under your insecticide-treated net every night. Pregnant women and children with fever should be tested same-day.',
      audience: 'all',
      createdAt: daysAgo(7),
    },
    {
      type: 'campaign',
      title: 'Mental Health Support Group — JRS Kakuma 3',
      message:
        'Free, confidential psychosocial support group every Thursday 10am at the JRS Mental Health Unit, Kakuma 3. Open to adults of all backgrounds. Sessions run in English, Swahili and Arabic.',
      audience: 'all',
      createdAt: daysAgo(8),
    },
    {
      type: 'campaign',
      title: 'Polio Immunisation Round — Children Under 5',
      message:
        'House-to-house polio vaccination campaign begins next Monday across Kakuma 1–4 and Kalobeyei. Vaccinators in green vests will visit your block — please welcome them. Two oral drops per child.',
      audience: 'all',
      createdAt: daysAgo(9),
    },
    {
      type: 'campaign',
      title: 'Free Eye Clinic — Cataract Screening',
      message:
        'Lions Club partners with AMREF to offer free eye exams and cataract surgery referrals at Kakuma Mission Hospital, 18–22 of this month. Especially for elders and people with blurred vision.',
      audience: 'all',
      createdAt: daysAgo(10),
    },
    {
      type: 'campaign',
      title: 'Nutrition Screening for Children Under 2',
      message:
        'UNICEF & WFP partners are screening all children under 2 years for malnutrition this week at every Health Post. Bring your child for a quick MUAC check — under 5 minutes.',
      audience: 'all',
      createdAt: daysAgo(11),
    },
    {
      type: 'alert',
      title: 'Snakebite Reminder — Rains Increase Risk',
      message:
        'With the rains, snake activity rises. Wear closed shoes after dark, sleep under a net tucked under the mattress, and go straight to Amusait Hospital if bitten. Do NOT cut the wound or apply ice.',
      audience: 'all',
      createdAt: daysAgo(12),
    },
    {
      type: 'campaign',
      title: 'COVID-19 Booster Doses Available',
      message:
        'COVID-19 booster shots available for adults 18+ at Kakuma Sub-County Hospital and Kalobeyei Main. Especially recommended for elders, pregnant women, and people with chronic illness.',
      audience: 'all',
      createdAt: daysAgo(13),
    },
    {
      type: 'campaign',
      title: 'Free Dental Day — Children & Adults',
      message:
        'KRCS & Colgate community dental day this Friday at Kakuma Town Centre, 9am–3pm. Free check-ups, cleaning, fluoride for children and free toothbrushes while stocks last.',
      audience: 'all',
      createdAt: daysAgo(14),
    },
    {
      type: 'campaign',
      title: 'GBV Survivors — 24/7 Confidential Support',
      message:
        'If you or someone you know has experienced gender-based violence, IRC offers free, confidential medical care, counselling and safe shelter. Call the GBV hotline anytime — your asylum status is not affected.',
      audience: 'all',
      createdAt: daysAgo(15),
    },
    {
      type: 'campaign',
      title: 'Voluntary Blood Donation — KRCS Mobile Clinic',
      message:
        'KRCS mobile blood donation unit will be at Kakuma Town Centre next Wednesday, 8am–4pm. Healthy adults aged 18–65 weighing more than 50kg are welcome. Free juice and snacks provided.',
      audience: 'all',
      createdAt: daysAgo(16),
    },
    {
      type: 'campaign',
      title: 'Diabetes & Hypertension Screening Day',
      message:
        'Free blood pressure and blood sugar checks every last Friday of the month at all Health Posts. Adults 35+ are strongly encouraged to attend — early detection saves lives.',
      audience: 'all',
      createdAt: daysAgo(17),
    },
  ];
  await Notification.insertMany(ANNOUNCEMENTS);

  console.log(`[seed] done. ${docs.length} education docs, ${TOPICS.length} topics, ${Object.keys(ORGS).length} partner orgs.`);
  await disconnectDb();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
