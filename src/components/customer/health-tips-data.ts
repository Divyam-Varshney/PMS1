// ============================================================================
// File: src/components/customer/health-tips-data.ts
// Purpose: Shared health tips data module — powers both the homepage "Health
//          Tips & Articles" strip (short description) and the full article
//          view (content + takeaways). Contains 15+ curated pharmacy/health
//          tips with full content written by a virtual pharmacist.
//          `pickDailyHealthTips(count)` rotates tips daily so the homepage
//          always shows a fresh set.
// ============================================================================

// Lucide icons are imported by the consumer (home-view / health-tip-view) and
// passed via the `icon` field name. To keep this module free of JSX, we store
// the icon as a string key and map it to the actual icon component in the
// consumer. This avoids pulling React/lucide into a pure data module.
export type HealthTipIcon =
  | "HeartPulse"
  | "Droplets"
  | "Pill"
  | "Sun"
  | "Moon"
  | "Activity"
  | "Brain"
  | "Bone"
  | "Eye"
  | "Apple"
  | "Stethoscope"
  | "Thermometer"
  | "Wind"
  | "Shield"
  | "Baby"
  | "Leaf";

export interface HealthTip {
  id: number;
  icon: HealthTipIcon;
  title: string;
  shortDescription: string;
  /** Gradient classes (tailwind) for the homepage card header. */
  gradient: string;
  /** Full article body — array of paragraphs. */
  content: string[];
  /** 3-5 actionable takeaways shown as a checklist at the end of the article. */
  takeaways: string[];
  /** Estimated read time in minutes (for the article meta). */
  readTime: number;
}

export const HEALTH_TIPS: HealthTip[] = [
  {
    id: 0,
    icon: "HeartPulse",
    title: "Managing Diabetes in Summer",
    shortDescription:
      "Heat can affect blood sugar levels and insulin storage. Stay hydrated, monitor glucose more often, and keep insulin cool to manage diabetes safely during the hot summer months.",
    gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    readTime: 4,
    content: [
      "Summer heat poses unique challenges for people living with diabetes. High temperatures can alter how your body uses insulin and may cause blood sugar levels to swing unpredictably. Sweating more in the heat can also lead to dehydration, which concentrates glucose in the bloodstream and pushes readings higher.",
      "Insulin and certain diabetes medications (such as GLP-1 agonists and SGLT2 inhibitors) are sensitive to temperature. Insulin stored above 30°C can lose potency, leading to poor blood sugar control even when you follow your routine perfectly. Always carry insulin in a cool pouch with an ice pack — never freeze it.",
      "Heat can also mask the symptoms of hypoglycemia (low blood sugar). Sweating, dizziness, and fatigue are common to both, so check your glucose with a glucometer or CGM before assuming the cause. Test more frequently on hot days — at least 4-6 times — and always carry fast-acting carbs like glucose tablets.",
      "Foot care is especially important in summer. Open footwear and sweaty feet increase the risk of fungal infections and small cuts that can go unnoticed due to diabetic neuropathy. Inspect your feet daily, moisturize (but not between the toes), and never walk barefoot — even indoors.",
    ],
    takeaways: [
      "Store insulin below 30°C — use a cool pouch with an ice pack when travelling.",
      "Test blood sugar 4-6 times a day in summer; heat can mask hypo symptoms.",
      "Drink 2.5-3 litres of water daily; dehydration falsely raises glucose readings.",
      "Inspect your feet every evening for cuts, blisters, or fungal infections.",
      "Avoid strenuous outdoor activity between 11 AM and 4 PM.",
    ],
  },
  {
    id: 1,
    icon: "Droplets",
    title: "Importance of Daily Hydration",
    shortDescription:
      "Water is essential for every cell in your body. Discover how much water you really need each day and the early signs of dehydration to watch for in summer.",
    gradient: "from-teal-500 via-emerald-500 to-green-600",
    readTime: 3,
    content: [
      "Water makes up about 60% of your body weight and is involved in nearly every biological process — from regulating temperature and lubricating joints to flushing out waste and carrying nutrients to cells. Even mild dehydration (a 1-2% drop in body water) can impair concentration, mood, and physical performance.",
      "The popular '8 glasses a day' rule is a useful starting point, but your actual needs depend on body weight, activity level, climate, and diet. A more accurate guide is 30-35 ml of water per kilogram of body weight per day — roughly 2.5-3 litres for a 75 kg adult in a temperate climate, and more in summer or during exercise.",
      "Thirst is not always a reliable indicator — by the time you feel thirsty, you may already be mildly dehydrated. A simpler check is urine colour: pale straw or nearly clear means you're well hydrated; dark yellow or amber means drink more. Caffeinated beverages and alcohol are mild diuretics and should not count toward your daily water goal.",
      "Older adults and young children are at higher risk of dehydration because their thirst mechanism is less sensitive. If you take diuretics (water pills) for blood pressure or heart conditions, talk to your doctor about adjusting your fluid intake in summer.",
    ],
    takeaways: [
      "Aim for 2.5-3 litres of water daily (more in summer or during exercise).",
      "Check urine colour — pale straw means you're well hydrated.",
      "Don't wait for thirst; sip water throughout the day.",
      "Carry a 1-litre bottle and refill it 2-3 times.",
      "Add lemon, mint, or cucumber if plain water feels boring.",
    ],
  },
  {
    id: 2,
    icon: "Pill",
    title: "Safe Use of Antibiotics",
    shortDescription:
      "Antibiotics treat bacterial infections, not viruses. Learn when they're truly needed, why completing the full course matters, and how to avoid antibiotic resistance.",
    gradient: "from-cyan-500 via-teal-500 to-emerald-600",
    readTime: 5,
    content: [
      "Antibiotics are one of the most important discoveries in modern medicine, but their misuse has led to a global crisis: antibiotic resistance. When bacteria are exposed to antibiotics too often — or in the wrong doses — they evolve to survive the drugs designed to kill them. The result: 'superbugs' that are extremely difficult to treat.",
      "The first thing to understand is that antibiotics work only against bacteria. They have no effect on viruses — which means they are useless for the common cold, flu, most sore throats, and many cases of diarrhoea. Taking antibiotics for viral infections doesn't help you recover faster and contributes directly to resistance.",
      "If your doctor does prescribe antibiotics, take them exactly as directed. Do not skip doses, do not double up if you miss one, and most importantly — complete the full course even if you feel better after 2-3 days. Stopping early allows the strongest bacteria to survive and multiply, increasing the chance of a resistant infection later.",
      "Never share antibiotics with others or save leftover pills for future use. Different infections require different antibiotics at different doses. What worked for your throat infection may not work for a urinary tract infection, even if the symptoms feel similar.",
      "If you experience side effects like severe diarrhoea, rash, or breathing difficulty while on antibiotics, stop taking the medicine and contact your doctor immediately. Some antibiotic allergies can be life-threatening.",
    ],
    takeaways: [
      "Antibiotics do not work on viruses — colds, flu, and most coughs are viral.",
      "Always complete the full prescribed course, even if you feel better.",
      "Never share antibiotics or save leftovers for later use.",
      "Take probiotics 2 hours apart from antibiotics to protect gut flora.",
      "Report severe side effects (rash, diarrhoea, breathing issues) immediately.",
    ],
  },
  {
    id: 3,
    icon: "Sun",
    title: "Sun Protection & Vitamin D",
    shortDescription:
      "Balance sun exposure for vitamin D with skin protection. Learn the right SPF, the best times for sunlight, and signs of heat exhaustion.",
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    readTime: 4,
    content: [
      "Sunlight is our primary source of vitamin D — a hormone that regulates calcium absorption, bone health, and immune function. Yet too much sun exposure increases the risk of skin cancer, premature ageing, and sunburn. Finding the right balance is key.",
      "For vitamin D production, 10-30 minutes of midday sunlight on exposed arms and legs, 2-3 times a week, is usually sufficient for most skin types in India. Darker skin needs more time, lighter skin less. After this window, apply sunscreen to prevent damage.",
      "Choose a broad-spectrum sunscreen with SPF 30 or higher that protects against both UVA (ageing) and UVB (burning) rays. Apply 15-20 minutes before going out and reapply every 2 hours, or immediately after swimming or heavy sweating. Don't forget easily-missed spots: ears, back of the neck, tops of the feet, and the parting in your hair.",
      "Heat exhaustion is a milder heat-related illness that can progress to heatstroke if untreated. Symptoms include heavy sweating, weakness, dizziness, nausea, and a rapid pulse. Move to a cool place, drink water with a pinch of salt, and loosen tight clothing. If symptoms worsen or you stop sweating despite the heat, seek emergency care — this is heatstroke, a life-threatening condition.",
    ],
    takeaways: [
      "Get 10-30 minutes of midday sun 2-3 times a week for vitamin D.",
      "Use broad-spectrum SPF 30+ sunscreen; reapply every 2 hours outdoors.",
      "Avoid direct sun between 11 AM and 3 PM when UV is strongest.",
      "Wear a wide-brimmed hat and UV-blocking sunglasses.",
      "Watch for heat exhaustion: heavy sweating, dizziness, nausea — cool down immediately.",
    ],
  },
  {
    id: 4,
    icon: "Moon",
    title: "Better Sleep for Better Health",
    shortDescription:
      "Quality sleep is as important as diet and exercise. Discover science-backed habits to fall asleep faster, sleep deeper, and wake up refreshed.",
    gradient: "from-indigo-500 via-purple-500 to-pink-500",
    readTime: 4,
    content: [
      "Sleep is not 'wasted time' — it is when your body repairs tissues, consolidates memories, regulates hormones, and clears waste from the brain. Chronic sleep deprivation (less than 6 hours per night) is linked to obesity, type 2 diabetes, heart disease, and a weakened immune system.",
      "Most adults need 7-9 hours of sleep per night. The best way to know if you're getting enough is how you feel during the day: if you need an alarm to wake up, rely on caffeine to function, or feel drowsy while reading or watching TV in the afternoon, you're probably sleep-deprived.",
      "Your circadian rhythm — the body's internal 24-hour clock — is most stable when you sleep and wake at the same time every day, including weekends. A consistent routine anchors your sleep cycle and makes falling asleep at night easier.",
      "Light is the strongest signal for your circadian rhythm. Bright light (especially blue light from phones and laptops) in the evening suppresses melatonin, the sleep hormone. Aim to dim lights 2 hours before bed and avoid screens for at least 30 minutes before sleeping. If you must use devices, enable night mode or blue-light filters.",
      "Caffeine has a half-life of 5-6 hours, meaning a 4 PM coffee still has half its stimulant effect at 10 PM. If you have trouble sleeping, avoid caffeine after 2 PM. Alcohol may help you fall asleep faster but disrupts the second half of the night, leading to fragmented, less restorative sleep.",
    ],
    takeaways: [
      "Aim for 7-9 hours of sleep; keep a consistent sleep-wake schedule.",
      "Avoid screens and bright light for 30+ minutes before bed.",
      "Cut caffeine after 2 PM — its effects last 5-6 hours.",
      "Keep the bedroom cool (18-22°C), dark, and quiet.",
      "Avoid large meals and alcohol within 3 hours of bedtime.",
    ],
  },
  {
    id: 5,
    icon: "Activity",
    title: "Daily Movement for Heart Health",
    shortDescription:
      "You don't need a gym membership to keep your heart healthy. Learn how much exercise is enough and easy ways to add movement to your day.",
    gradient: "from-rose-500 via-pink-500 to-fuchsia-500",
    readTime: 3,
    content: [
      "Your heart is a muscle, and like any muscle, it gets stronger with regular exercise. The World Health Organization recommends at least 150 minutes of moderate-intensity aerobic activity per week — about 22 minutes a day. This can be brisk walking, cycling, swimming, dancing, or even active household chores.",
      "Moderate intensity means your heart rate rises to about 50-70% of its maximum (roughly 220 minus your age). A simple talk test: you should be able to hold a conversation but not sing. If you can sing, push harder; if you can't talk at all, slow down.",
      "If 30 minutes at once feels daunting, break it up. Three 10-minute walks — morning, lunch, and evening — give nearly the same cardiovascular benefits as one 30-minute session. Even standing up every 30 minutes during desk work improves circulation compared to sitting all day.",
      "Strength training (using body weight, resistance bands, or weights) 2-3 times a week is equally important. It preserves muscle mass, improves insulin sensitivity, and strengthens bones. Start with simple exercises: squats, push-ups, lunges, planks.",
      "Before starting a new exercise routine, especially if you have a chronic condition like heart disease, diabetes, or arthritis, consult your doctor. Start slow, listen to your body, and gradually increase intensity over weeks — not days.",
    ],
    takeaways: [
      "Aim for 150 minutes of moderate aerobic activity per week.",
      "Break it up — three 10-minute walks are nearly as effective as one 30-minute session.",
      "Add strength training 2-3 times a week (squats, push-ups, planks).",
      "Use the talk test: you should be able to converse but not sing.",
      "Stand up and move for 1-2 minutes every half hour during desk work.",
    ],
  },
  {
    id: 6,
    icon: "Brain",
    title: "Mental Wellness & Stress Management",
    shortDescription:
      "Chronic stress affects both mind and body. Explore evidence-based techniques — from breathing exercises to gratitude — that take just minutes a day.",
    gradient: "from-violet-500 via-purple-500 to-indigo-500",
    readTime: 5,
    content: [
      "Stress is not just a feeling — it is a physiological response. When you perceive a threat (real or imagined), your body releases cortisol and adrenaline, raising blood pressure, blood sugar, and heart rate. Short bursts of stress are normal and even helpful. Chronic stress, however, keeps these hormones elevated and contributes to hypertension, diabetes, depression, and a weakened immune system.",
      "The good news is that the stress response can be deliberately switched off using the breath. Slow, deep breathing activates the parasympathetic nervous system (the 'rest and digest' mode), lowering heart rate and blood pressure within minutes. Try '4-7-8 breathing': inhale for 4 seconds, hold for 7, exhale slowly for 8. Repeat 4 cycles.",
      "Mindfulness meditation — the practice of paying attention to the present moment without judgement — has been shown in dozens of studies to reduce anxiety, improve focus, and even change brain structure over time. Start with just 5 minutes a day using a free app or guided audio.",
      "Physical activity is one of the most effective natural stress relievers. Exercise burns off excess adrenaline and releases endorphins — the body's natural mood elevators. Even a 10-minute walk outdoors can shift your mental state.",
      "Connection matters. Talking to a trusted friend or family member about what's bothering you reduces cortisol levels. If stress is affecting your sleep, appetite, or relationships for more than 2 weeks, consider speaking to a mental health professional. Therapy is not a sign of weakness — it's a sign of self-awareness.",
    ],
    takeaways: [
      "Try 4-7-8 breathing (inhale 4s, hold 7s, exhale 8s) for instant calm.",
      "Practice 5 minutes of mindfulness meditation daily.",
      "Move your body — even 10 minutes of walking lowers cortisol.",
      "Reach out to friends or family; social connection buffers stress.",
      "If stress persists for 2+ weeks, talk to a mental health professional.",
    ],
  },
  {
    id: 7,
    icon: "Bone",
    title: "Bone Health & Calcium Needs",
    shortDescription:
      "Strong bones need calcium, vitamin D, and weight-bearing exercise. Find out how much you need at every age and the best dietary sources.",
    gradient: "from-slate-500 via-gray-500 to-zinc-600",
    readTime: 4,
    content: [
      "Bones are living tissue that constantly breaks down and rebuilds. Up to age 30, you build bone faster than you lose it; after that, the balance slowly shifts. By your late 20s, you've reached your peak bone mass — the more you build by then, the lower your risk of osteoporosis later in life.",
      "Calcium is the main building block of bone. Adults need 1000 mg per day (1200 mg for women over 50 and men over 70). The best dietary sources are dairy products (milk, curd, paneer), leafy greens (spinach, kale, fenugreek), sesame seeds, almonds, and fortified foods. A glass of milk + a bowl of curd + a portion of leafy greens typically covers your daily need.",
      "Calcium alone is not enough — your body cannot absorb it without vitamin D. As little as 15 minutes of midday sunlight on exposed skin, 3 times a week, is usually sufficient. If you have limited sun exposure, ask your doctor about a vitamin D supplement (typically 1000-2000 IU per day).",
      "Weight-bearing exercise — any activity where you work against gravity — stimulates bone formation. Walking, jogging, dancing, stair-climbing, and resistance training all qualify. Swimming and cycling, while excellent for cardiovascular health, do little for bone density because the water and bike support your weight.",
      "Excess salt, caffeine, and alcohol all increase calcium loss through urine. Smoking is particularly harmful — it reduces bone formation and accelerates bone loss. If you smoke, quitting is the single most important thing you can do for your bones (and your overall health).",
    ],
    takeaways: [
      "Adults need 1000 mg calcium/day (1200 mg after 50 for women, 70 for men).",
      "Get 15 minutes of sunlight 3x/week for vitamin D — essential for calcium absorption.",
      "Do weight-bearing exercise (walking, dancing, resistance training) 3-5x/week.",
      "Limit salt, caffeine, and alcohol — they increase calcium loss.",
      "Don't smoke. Smoking accelerates bone loss significantly.",
    ],
  },
  {
    id: 8,
    icon: "Eye",
    title: "Screen Time & Eye Health",
    shortDescription:
      "Long hours on screens cause dry eyes, blurred vision, and headaches. Learn the 20-20-20 rule and other simple ways to protect your eyes.",
    gradient: "from-sky-500 via-blue-500 to-indigo-500",
    readTime: 3,
    content: [
      "Digital eye strain (also called 'computer vision syndrome') affects up to 90% of people who use screens for more than 3 hours a day. Symptoms include dry eyes, blurred vision, headaches, neck and shoulder pain, and difficulty focusing at distance. The good news: most cases are preventable.",
      "The 20-20-20 rule is the simplest defence. Every 20 minutes, look at something 20 feet (6 metres) away for 20 seconds. This relaxes the focusing muscles inside your eyes and reduces fatigue. Set a phone timer or use a free app to remind you.",
      "When staring at screens, we blink about 60% less than normal — leading to dry, irritated eyes. consciously blink more often, and position your screen so the top is at or just below eye level. This makes your eyelids cover more of the eye surface, reducing evaporation.",
      "Lighting matters. Avoid working in a dark room with a bright screen — the contrast strains your eyes. Use ambient lighting that's about half as bright as your screen. Consider a matte screen filter to reduce glare, and enable 'night light' or blue-light filters in the evening.",
      "If you wear glasses, make sure your prescription is up to date. Computer glasses with anti-reflective coating can help if you spend long hours at a desk. Children are especially vulnerable to screen-related eye strain and myopia progression — encourage outdoor play (natural light protects against myopia) and limit recreational screen time.",
    ],
    takeaways: [
      "Follow the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds.",
      "Blink more often — we blink 60% less when staring at screens.",
      "Position the screen top at or just below eye level, 50-70 cm away.",
      "Match room lighting to screen brightness; avoid dark rooms with bright screens.",
      "Get an eye check-up annually if you use screens for 4+ hours a day.",
    ],
  },
  {
    id: 9,
    icon: "Apple",
    title: "Building a Balanced Diet",
    shortDescription:
      "No single food gives you everything. Learn the components of a balanced plate and simple swaps to make every meal healthier.",
    gradient: "from-red-500 via-orange-500 to-amber-500",
    readTime: 4,
    content: [
      "A balanced diet is one that gives your body all the nutrients it needs — carbohydrates, proteins, fats, vitamins, minerals, and fibre — in the right proportions. No single food can do this; variety is the foundation of healthy eating.",
      "A simple way to build a balanced plate: fill half with vegetables and fruits (the more colours, the better), a quarter with whole grains (brown rice, whole-wheat roti, oats, millets), and a quarter with protein (dal, chana, paneer, eggs, chicken, fish). Add a small portion of dairy (milk, curd) and a thumb-sized amount of healthy fats (nuts, seeds, ghee, olive oil).",
      "Fibre is the unsung hero of a healthy diet. Found in whole grains, legumes, fruits, and vegetables, fibre slows sugar absorption, lowers cholesterol, feeds beneficial gut bacteria, and keeps you regular. Adults need 25-30 grams per day — most Indians get less than half of that. Adding two fruits, two portions of vegetables, and switching to whole grains usually closes the gap.",
      "Limit ultra-processed foods — packaged snacks, sugary drinks, refined flour, fried items. They are typically high in sugar, salt, and unhealthy fats, and low in nutrients. Read labels: if a product has more than 5 ingredients you can't pronounce, it's probably best limited.",
      "Hydration is part of nutrition too. Sometimes thirst masquerades as hunger — drinking a glass of water before meals can prevent overeating. Herbal teas, buttermilk, and coconut water all count toward your daily fluid intake.",
    ],
    takeaways: [
      "Fill half your plate with vegetables and fruits — eat the rainbow.",
      "Choose whole grains (brown rice, oats, millets) over refined flour.",
      "Aim for 25-30g of fibre per day — most Indians get less than half.",
      "Limit ultra-processed foods, sugary drinks, and fried snacks.",
      "Drink a glass of water before meals to prevent overeating.",
    ],
  },
  {
    id: 10,
    icon: "Stethoscope",
    title: "Routine Health Check-ups",
    shortDescription:
      "Prevention is better than cure. Discover which tests and screenings you need at every stage of life — and how often to get them.",
    gradient: "from-emerald-600 via-teal-600 to-cyan-700",
    readTime: 5,
    content: [
      "Many chronic diseases — high blood pressure, type 2 diabetes, high cholesterol, thyroid disorders — develop silently over years before symptoms appear. By the time you feel unwell, the disease may already be advanced. Routine health check-ups catch these conditions early, when they are most treatable.",
      "For healthy adults under 40, a basic annual check-up is usually sufficient: blood pressure, BMI, fasting blood sugar, lipid profile (cholesterol), complete blood count, and thyroid function (TSH). Add a urine routine and a liver/kidney function test every 2-3 years.",
      "After 40, the checklist expands. Add an ECG, HbA1c (3-month blood sugar average), vitamin D, vitamin B12, and a cancer screening appropriate to your gender — Pap smear and clinical breast exam for women, prostate check for men over 50. Colon cancer screening (stool test or colonoscopy) starts at 50 for average-risk adults.",
      "Don't forget dental and eye check-ups. Gum disease is linked to heart disease, and uncorrected vision problems cause headaches and falls, especially in older adults. Visit the dentist every 6 months and the eye doctor annually after age 40.",
      "Vaccinations are not just for children. Adults should get a flu shot every year (especially if over 65 or with chronic conditions), a tetanus booster every 10 years, and the shingles vaccine after 50. If you have diabetes, kidney disease, or a weakened immune system, your doctor may recommend additional vaccines.",
    ],
    takeaways: [
      "Annual check-up: BP, BMI, blood sugar, cholesterol, CBC, TSH.",
      "After 40: add ECG, HbA1c, vitamin D, B12, and gender-appropriate cancer screening.",
      "Dental check-up every 6 months; eye check-up annually after 40.",
      "Stay current on adult vaccines: flu yearly, tetanus every 10 years.",
      "Keep a personal health record — track results year over year.",
    ],
  },
  {
    id: 11,
    icon: "Thermometer",
    title: "Fever: When to Worry",
    shortDescription:
      "Not every fever needs antibiotics or a doctor visit. Learn the red-flag symptoms that signal a serious infection and how to manage fever at home.",
    gradient: "from-orange-500 via-red-500 to-rose-600",
    readTime: 4,
    content: [
      "Fever is not a disease — it is the body's natural defence against infection. A raised body temperature helps immune cells work more efficiently and makes the environment less hospitable to bacteria and viruses. In most cases, a fever of 38-39°C (100-102°F) in an otherwise healthy adult can be managed at home.",
      "The first step is supportive care: rest, drink plenty of fluids (water, ORS, coconut water, clear soups), and wear light clothing. Paracetamol (650 mg for adults) every 6 hours as needed helps bring the temperature down and relieves body aches. Avoid aspirin in children and teenagers due to the risk of Reye's syndrome.",
      "Most viral fevers resolve in 3-5 days. However, certain red flags warrant immediate medical attention: a temperature above 40°C (104°F), fever lasting more than 5 days, severe headache with neck stiffness, persistent vomiting, breathing difficulty, confusion or unusual drowsiness, a rash that doesn't fade when pressed, or fever in a baby under 3 months old.",
      "In India, fever is a common early symptom of dengue, malaria, typhoid, and chikungunya. If your fever is accompanied by severe joint pain, bleeding gums, rash, or abdominal pain, get a blood test (CBC, MP card, NS1 antigen, Widal) as recommended by your doctor. Self-medicating with antibiotics without a prescription is dangerous — it can mask symptoms, cause side effects, and contribute to antibiotic resistance.",
      "Children with fever need special attention. Watch their behaviour — a child who is playing and drinking normally between fever spikes is usually fine. A child who is lethargic, refuses fluids, or has difficulty breathing needs urgent medical evaluation, regardless of the temperature reading.",
    ],
    takeaways: [
      "Fever is the body's defence — not every fever needs medication.",
      "Rest, hydrate, wear light clothes; paracetamol 650 mg every 6 hours as needed.",
      "See a doctor for fever >40°C, lasting >5 days, or with neck stiffness, rash, or breathing issues.",
      "Never self-prescribe antibiotics for fever — it can mask symptoms and cause resistance.",
      "In children, watch behaviour more than the thermometer — lethargy or refusing fluids needs urgent care.",
    ],
  },
  {
    id: 12,
    icon: "Wind",
    title: "Managing Asthma & Allergies",
    shortDescription:
      "Asthma and allergies often go hand in hand. Learn how to identify triggers, use inhalers correctly, and live well with respiratory conditions.",
    gradient: "from-cyan-400 via-sky-500 to-blue-500",
    readTime: 5,
    content: [
      "Asthma is a chronic condition in which the airways become inflamed and narrow in response to certain triggers, causing wheezing, coughing, chest tightness, and shortness of breath. It often coexists with allergic rhinitis (hay fever) and eczema — together known as the 'atopic triad'.",
      "Common triggers include dust mites, pollen, pet dander, cockroach droppings, mould, cold air, exercise, respiratory infections, tobacco smoke, strong odours, and certain medications (such as aspirin and beta-blockers). Identifying and avoiding your personal triggers is the first line of defence. Keep a symptom diary for 2-4 weeks to spot patterns.",
      "Inhalers are the cornerstone of asthma treatment. There are two main types: relievers (like salbutamol) that open the airways quickly during an attack, and controllers (like inhaled corticosteroids) that reduce inflammation over time and prevent attacks. Most people with persistent asthma need both — the controller daily, the reliever as needed.",
      "Using an inhaler correctly is crucial — studies show up to 70% of patients use them incorrectly, getting only a fraction of the medicine into their lungs. If you use a metered-dose inhaler (MDI), always use a spacer: it improves drug delivery by 2-3 times and reduces side effects. Rinse your mouth after using a corticosteroid inhaler to prevent oral thrush.",
      "An asthma action plan — written with your doctor — tells you what to do based on your symptoms and peak flow readings. It typically has three zones: green (well — take controller), yellow (caution — add reliever, increase controller), and red (danger — take reliever, seek medical help). Share this plan with family, school, and workplace so others can help in an emergency.",
    ],
    takeaways: [
      "Identify and avoid personal triggers — keep a 2-4 week symptom diary.",
      "Use a spacer with metered-dose inhalers — it improves drug delivery 2-3x.",
      "Rinse your mouth after corticosteroid inhalers to prevent oral thrush.",
      "Always carry your reliever (salbutamol) inhaler, even when you feel well.",
      "Have a written asthma action plan and share it with family and workplace.",
    ],
  },
  {
    id: 13,
    icon: "Shield",
    title: "Boosting Your Immunity",
    shortDescription:
      "There is no magic pill for immunity — but a few simple habits can keep your immune system strong and resilient year-round.",
    gradient: "from-green-500 via-emerald-500 to-teal-600",
    readTime: 4,
    content: [
      "Your immune system is a complex network of cells, tissues, and organs that defends against infections and diseases. Despite the marketing claims, no single supplement or 'superfood' can boost it overnight. Immune health is built over time through consistent, healthy habits.",
      "Sleep is the foundation. During deep sleep, your immune system releases proteins called cytokines that help fight infection and inflammation. Chronic sleep deprivation reduces these protective cytokines and infection-fighting antibodies. Aim for 7-9 hours per night.",
      "A nutrient-rich diet fuels immune cells. Focus on vitamin C (citrus, peppers, amla), vitamin D (sunlight, fatty fish, fortified foods), zinc (pumpkin seeds, lentils, meat), and selenium (Brazil nuts, eggs). A diverse, plant-rich diet naturally provides these — supplements are rarely needed unless you have a confirmed deficiency.",
      "Regular, moderate exercise flushes bacteria out of the lungs and airways and circulates immune cells more quickly through the body. However, prolonged intense exercise without recovery can temporarily weaken immunity. Aim for 30 minutes of moderate activity most days, with at least one rest day per week.",
      "Chronic stress raises cortisol levels, which suppress immune function over time. Mindfulness, deep breathing, social connection, and hobbies all help. Smoking and excess alcohol also damage immune cells — quitting smoking is one of the best things you can do for your immune system.",
    ],
    takeaways: [
      "Prioritise 7-9 hours of sleep — it's when your immune system recharges.",
      "Eat a varied, plant-rich diet; supplements rarely beat whole foods.",
      "Exercise moderately most days, with rest days to avoid overtraining.",
      "Manage stress — chronic cortisol suppresses immunity.",
      "Don't smoke and limit alcohol — both weaken immune cells.",
    ],
  },
  {
    id: 14,
    icon: "Baby",
    title: "Medicine Safety for Children",
    shortDescription:
      "Children are not small adults. Learn how to safely store, dose, and administer medicines to kids — and the household items most often involved in poisoning.",
    gradient: "from-pink-400 via-rose-400 to-red-500",
    readTime: 5,
    content: [
      "Children's bodies process medicines differently from adults — they absorb, distribute, and eliminate drugs at different rates. A dose that is safe for an adult can be dangerous for a child, and a medicine that is safe at one age may be unsafe at another. Always use the formulation and dose recommended for your child's age and weight, never approximate from adult doses.",
      "Dose by weight, not age. Two children of the same age can weigh very differently. Use a proper measuring device — the oral syringe or dosing cup that comes with the medicine, not a kitchen spoon (which can vary by 30% or more). If the package gives a dose range, use the lower end for smaller children.",
      "Storage is critical. Keep all medicines — including over-the-counter ones like paracetamol and cough syrups — in their original, child-resistant packaging, stored high up and out of reach. The most common causes of accidental child poisoning are not prescription drugs but everyday items: paracetamol, iron tablets, vitamins (especially gummies), household cleaners, and mosquito repellents.",
      "Never call medicine 'candy' to coax a child into taking it. This teaches them to seek it out later. Instead, explain honestly what the medicine is for and why they need it. If a child refuses, ask your paediatrician about alternatives — many medicines come in flavoured liquids, dissolvable tablets, or suppositories.",
      "If you suspect your child has taken too much medicine or swallowed something they shouldn't have, do not wait for symptoms. Call your local poison control centre (in India, the AIIMS Poison Centre: 011-26593277) or rush to the nearest emergency room. Take the medicine bottle or packaging with you — it helps doctors identify the substance and dose quickly.",
    ],
    takeaways: [
      "Dose by weight, not age — use the oral syringe, never a kitchen spoon.",
      "Store medicines high up, in child-resistant packaging, out of reach.",
      "Never call medicine 'candy' — it encourages risky curiosity later.",
      "Watch out for everyday items: paracetamol, iron, vitamins, cleaners.",
      "Suspected poisoning? Call poison control or go to ER immediately with the bottle.",
    ],
  },
  {
    id: 15,
    icon: "Leaf",
    title: "Reading Medicine Labels",
    shortDescription:
      "Medicine labels carry vital information — from dosage to expiry. Learn what each section means and what to check before every dose.",
    gradient: "from-lime-500 via-green-500 to-emerald-600",
    readTime: 4,
    content: [
      "Every medicine label — whether over-the-counter or prescription — carries essential information that helps you use the drug safely and effectively. Yet most people never read beyond the brand name. Taking 2 minutes to read the label can prevent allergic reactions, side effects, and dangerous interactions.",
      "Start with the active ingredient (generic name), usually printed in small print below or beside the brand name. Many combination products contain the same active ingredient under different brands — taking them together can cause an overdose. For example, paracetamol appears in dozens of cold, flu, and pain products (Crocin, Dolo, Combiflam, Sinarest, Saridon, and more).",
      "Check the dosage and frequency. 'Twice daily' means roughly every 12 hours, not any two times — keeping a consistent gap keeps the drug level steady in your blood. 'As needed' medicines (like pain relievers) usually have a maximum daily dose printed on the label — never exceed it without medical advice.",
      "The expiry date is the last day the manufacturer guarantees the full potency and safety of the medicine. After this date, the drug may lose effectiveness or, in rare cases (like tetracycline), become toxic. Never use expired medicines — and never flush them down the toilet (it contaminates water). Return them to a pharmacy that participates in a take-back programme.",
      "Look for warning labels and contraindications — 'do not take with alcohol', 'may cause drowsiness', 'avoid in pregnancy', 'not for children under 12'. These are not suggestions; they are critical safety information. If you take multiple prescription medicines, ask your doctor or pharmacist about possible interactions.",
    ],
    takeaways: [
      "Read the active ingredient (generic name) — many products share the same one.",
      "Watch for hidden paracetamol in cold/flu combinations to avoid overdose.",
      "'Twice daily' = every 12 hours; keep gaps consistent for steady drug levels.",
      "Never use expired medicines; return them to a pharmacy, don't flush.",
      "Check warning labels — drowsiness, alcohol, pregnancy, age limits.",
    ],
  },
];

// ---------------------------------------------------------------------------
// pickDailyHealthTips(count)
// Rotates the tips daily using the current UTC day-of-month as a seed. Returns
// `count` consecutive tips (wrapping around). Same day = same tips, so a
// returning customer sees a consistent homepage within a single visit.
// IMPORTANT: uses getUTCDate() (not getDate()) so the server and client
// compute the same seed — preventing React hydration mismatches when the
// server and client are in different timezones.
// ---------------------------------------------------------------------------
export function pickDailyHealthTips(count: number): HealthTip[] {
  if (HEALTH_TIPS.length === 0) return [];
  const n = Math.min(count, HEALTH_TIPS.length);
  const start = new Date().getUTCDate() % HEALTH_TIPS.length;
  const result: HealthTip[] = [];
  for (let i = 0; i < n; i++) {
    result.push(HEALTH_TIPS[(start + i) % HEALTH_TIPS.length]);
  }
  return result;
}

// Convenience: get a single tip by id (used by the article view).
export function getHealthTipById(id: number): HealthTip | undefined {
  return HEALTH_TIPS.find((t) => t.id === id);
}
