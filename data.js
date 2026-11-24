// BloodLink Initial Seed Data & Compatibility Rules
// Demonstration Data - Realistic Healthcare Information

const BLOOD_COMPATIBILITY = {
  'O-': {
    canDonateTo: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], // Universal Red Cell Donor
    canReceiveFrom: ['O-'],
    rarity: '7% of population (Universal Donor)'
  },
  'O+': {
    canDonateTo: ['O+', 'A+', 'B+', 'AB+'],
    canReceiveFrom: ['O-', 'O+'],
    rarity: '37% of population (Most common)'
  },
  'A-': {
    canDonateTo: ['A-', 'A+', 'AB-', 'AB+'],
    canReceiveFrom: ['O-', 'A-'],
    rarity: '6% of population'
  },
  'A+': {
    canDonateTo: ['A+', 'AB+'],
    canReceiveFrom: ['O-', 'O+', 'A-', 'A+'],
    rarity: '34% of population'
  },
  'B-': {
    canDonateTo: ['B-', 'B+', 'AB-', 'AB+'],
    canReceiveFrom: ['O-', 'B-'],
    rarity: '2% of population'
  },
  'B+': {
    canDonateTo: ['B+', 'AB+'],
    canReceiveFrom: ['O-', 'O+', 'B-', 'B+'],
    rarity: '9% of population'
  },
  'AB-': {
    canDonateTo: ['AB-', 'AB+'],
    canReceiveFrom: ['O-', 'A-', 'B-', 'AB-'],
    rarity: '1% of population (Rare)'
  },
  'AB+': {
    canDonateTo: ['AB+'],
    canReceiveFrom: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], // Universal Recipient
    rarity: '4% of population (Universal Recipient)'
  }
};

const INITIAL_DONORS = [
  {
    id: 'DON-101',
    name: 'Sarah Chen',
    bloodGroup: 'O-',
    age: 28,
    gender: 'Female',
    city: 'Metro Central',
    area: 'Downtown Medical District',
    distanceKm: 2.4,
    phone: '+1 (555) 234-5678',
    email: 'sarah.chen@example.com',
    available: true,
    verified: true,
    totalDonations: 8,
    lastDonationDate: '2026-07-15',
    readyForUrgent: true,
    badges: ['Universal Hero', 'Life Saver (8x)'],
    bio: 'Regular blood donor since 2021. Work near City Central Hospital.'
  },
  {
    id: 'DON-102',
    name: 'David Rodriguez',
    bloodGroup: 'A+',
    age: 34,
    gender: 'Male',
    city: 'Metro Central',
    area: 'Riverside West',
    distanceKm: 4.8,
    phone: '+1 (555) 345-6789',
    email: 'david.rodriguez@example.com',
    available: true,
    verified: true,
    totalDonations: 12,
    lastDonationDate: '2026-08-01',
    readyForUrgent: true,
    badges: ['Gold Donor', 'On-Call Hero'],
    bio: 'Platelet and whole blood donor. Available on weekends and evenings.'
  },
  {
    id: 'DON-103',
    name: 'Priya Sharma',
    bloodGroup: 'B+',
    age: 26,
    gender: 'Female',
    city: 'Metro Central',
    area: 'Tech Park North',
    distanceKm: 6.2,
    phone: '+1 (555) 456-7890',
    email: 'priya.sharma@example.com',
    available: true,
    verified: true,
    totalDonations: 5,
    lastDonationDate: '2026-06-20',
    readyForUrgent: false,
    badges: ['Active Volunteer'],
    bio: 'Software engineer & blood donor. Glad to assist planned or urgent needs.'
  },
  {
    id: 'DON-104',
    name: 'Michael Chang',
    bloodGroup: 'AB+',
    age: 31,
    gender: 'Male',
    city: 'Metro Central',
    area: 'Highland Heights',
    distanceKm: 8.5,
    phone: '+1 (555) 567-8901',
    email: 'm.chang@example.com',
    available: false,
    verified: true,
    totalDonations: 6,
    lastDonationDate: '2026-09-28',
    readyForUrgent: false,
    badges: ['Universal Plasma Hero'],
    bio: 'Recently donated in late September. Resting until November 23.'
  },
  {
    id: 'DON-105',
    name: 'Amina Al-Mansoor',
    bloodGroup: 'O+',
    age: 29,
    gender: 'Female',
    city: 'Metro Central',
    area: 'Greenwood South',
    distanceKm: 3.1,
    phone: '+1 (555) 678-9012',
    email: 'amina.m@example.com',
    available: true,
    verified: true,
    totalDonations: 9,
    lastDonationDate: '2026-07-10',
    readyForUrgent: true,
    badges: ['Silver Guardian', 'Rapid Responder'],
    bio: 'Nurse by profession. Passionate about community blood supply.'
  },
  {
    id: 'DON-106',
    name: 'Lucas Keller',
    bloodGroup: 'A-',
    age: 40,
    gender: 'Male',
    city: 'Metro Central',
    area: 'Harbor Gateway',
    distanceKm: 5.7,
    phone: '+1 (555) 789-0123',
    email: 'lucas.keller@example.com',
    available: true,
    verified: true,
    totalDonations: 15,
    lastDonationDate: '2026-08-14',
    readyForUrgent: true,
    badges: ['Master Donor (15+)', 'Rare Type Hero'],
    bio: 'A- donor for 10 years. Ready for trauma center urgent callouts.'
  },
  {
    id: 'DON-107',
    name: 'Elena Rostova',
    bloodGroup: 'B-',
    age: 25,
    gender: 'Female',
    city: 'Metro Central',
    area: 'University Quarter',
    distanceKm: 3.9,
    phone: '+1 (555) 890-1234',
    email: 'elena.rostova@example.com',
    available: true,
    verified: true,
    totalDonations: 4,
    lastDonationDate: '2026-07-22',
    readyForUrgent: true,
    badges: ['Rare Type Hero'],
    bio: 'B- donor. Happy to travel within 15km for emergency pediatric cases.'
  },
  {
    id: 'DON-108',
    name: 'Dr. James Thorne',
    bloodGroup: 'AB-',
    age: 45,
    gender: 'Male',
    city: 'Metro Central',
    area: 'St. Jude Medical Annex',
    distanceKm: 1.8,
    phone: '+1 (555) 901-2345',
    email: 'j.thorne@example.com',
    available: true,
    verified: true,
    totalDonations: 18,
    lastDonationDate: '2026-08-05',
    readyForUrgent: true,
    badges: ['Ultra Rare Hero', 'Hospital Liaison'],
    bio: 'Clinical biochemist and ultra rare AB- donor.'
  }
];

const INITIAL_REQUESTS = [
  {
    id: 'REQ-8041',
    patientName: 'Emma Watson (Pediatric)',
    bloodGroup: 'O-',
    unitsRequired: 2,
    unitsMatched: 2,
    hospital: 'St. Jude Children & Trauma Center',
    location: 'Downtown Medical District, Ward 4B',
    city: 'Metro Central',
    urgency: 'Critical', // Critical, Urgent, Standard
    requiredBy: '2026-10-26T16:00',
    contactPerson: 'Dr. Marcus Vance (Coordinator)',
    contactPhone: '+1 (555) 911-0144',
    reason: 'Emergency surgery following severe acute anemia in pediatric ward.',
    status: 'In Progress', // Pending, Matched, In Progress, Completed
    createdAt: '2026-10-26T08:30:00',
    requesterType: 'Hospital',
    assignedDonors: ['Sarah Chen', 'Lucas Keller'],
    timeline: [
      { time: '08:30 AM', event: 'Emergency request created and verified by Trauma Staff.' },
      { time: '08:45 AM', event: 'O- donor alert broadcasted to 6 matched donors within 10km.' },
      { time: '09:12 AM', event: 'Sarah Chen accepted request; transit ETA 25 mins.' },
      { time: '10:00 AM', event: 'Unit 1 collected at Blood Bank. Processing screening.' }
    ]
  },
  {
    id: 'REQ-8042',
    patientName: 'Robert Vance',
    bloodGroup: 'B+',
    unitsRequired: 3,
    unitsMatched: 2,
    hospital: 'City General Medical Center',
    location: 'Riverside West, Wing C',
    city: 'Metro Central',
    urgency: 'Urgent',
    requiredBy: '2026-10-26T19:30',
    contactPerson: 'Karen Miller (Family Requester)',
    contactPhone: '+1 (555) 432-8765',
    reason: 'Elective cardiovascular bypass surgery scheduled for this evening.',
    status: 'Matched',
    createdAt: '2026-10-26T09:15:00',
    requesterType: 'Individual',
    assignedDonors: ['Priya Sharma'],
    timeline: [
      { time: '09:15 AM', event: 'Family submitted request with clinical verification.' },
      { time: '09:40 AM', event: 'Hospital blood bank confirmed 1 unit reserve, 2 units needed.' },
      { time: '10:30 AM', event: 'Donor Priya Sharma matched and confirmed arrival for 2:00 PM.' }
    ]
  },
  {
    id: 'REQ-8043',
    patientName: 'Claire Beauchamp',
    bloodGroup: 'A-',
    unitsRequired: 1,
    unitsMatched: 0,
    hospital: 'St. Mary Specialized Women & Care',
    location: 'Highland Heights, Floor 3',
    city: 'Metro Central',
    urgency: 'Critical',
    requiredBy: '2026-10-26T14:45',
    contactPerson: 'Nurse Supervisor Harris',
    contactPhone: '+1 (555) 765-4321',
    reason: 'Postpartum hemorrhage emergency. Immediate A- or O- replacement needed.',
    status: 'Pending',
    createdAt: '2026-10-26T11:10:00',
    requesterType: 'Hospital',
    assignedDonors: [],
    timeline: [
      { time: '11:10 AM', event: 'Critical emergency alert activated by Obstetrics triage.' },
      { time: '11:12 AM', event: 'BloodLink system dispatched instant high-priority notifications to all compatible donors within 15km.' }
    ]
  },
  {
    id: 'REQ-8044',
    patientName: 'Daniel Ortiz',
    bloodGroup: 'AB-',
    unitsRequired: 2,
    unitsMatched: 2,
    hospital: 'Metropolitan Heart & Oncology Institute',
    location: 'Tech Park North, Building 7',
    city: 'Metro Central',
    urgency: 'Standard',
    requiredBy: '2026-10-27T10:00',
    contactPerson: 'Dr. Thorne (Liaison)',
    contactPhone: '+1 (555) 901-2345',
    reason: 'Planned chemotherapy supportive care transfusion.',
    status: 'Completed',
    createdAt: '2026-10-25T14:00:00',
    requesterType: 'Hospital',
    assignedDonors: ['Dr. James Thorne', 'Elena Rostova'],
    timeline: [
      { time: 'Oct 25, 02:00 PM', event: 'Scheduled request entered for oncology patient.' },
      { time: 'Oct 25, 04:30 PM', event: 'Two matched donors scheduled donation appointment.' },
      { time: 'Oct 26, 09:30 AM', event: 'Both units successfully collected and cross-matched.' },
      { time: 'Oct 26, 11:00 AM', event: 'Request fulfilled and logged into hospital registry.' }
    ]
  },
  {
    id: 'REQ-8045',
    patientName: 'Kenneth Brooks',
    bloodGroup: 'O+',
    unitsRequired: 2,
    unitsMatched: 1,
    hospital: 'North Star Memorial Hospital',
    location: 'Greenwood South, Trauma Unit',
    city: 'Metro Central',
    urgency: 'Urgent',
    requiredBy: '2026-10-26T21:00',
    contactPerson: 'Arthur Brooks (Brother)',
    contactPhone: '+1 (555) 654-3210',
    reason: 'Orthopedic replacement post-accident complication.',
    status: 'Pending',
    createdAt: '2026-10-26T11:45:00',
    requesterType: 'Individual',
    assignedDonors: ['Amina Al-Mansoor'],
    timeline: [
      { time: '11:45 AM', event: 'Request registered by family coordinator.' },
      { time: '12:05 PM', event: 'Amina Al-Mansoor confirmed availability.' }
    ]
  }
];

const INITIAL_ACTIVITIES = [
  {
    id: 'ACT-1',
    type: 'response',
    title: 'Sarah Chen accepted urgent request',
    desc: 'O- donor responded to St. Jude Children & Trauma Center for Emma Watson.',
    time: '18 mins ago',
    badge: 'Urgent Response'
  },
  {
    id: 'ACT-2',
    type: 'new_request',
    title: 'New Emergency Request REQ-8043',
    desc: 'Claire Beauchamp requires 1 unit of A- at St. Mary Specialized Hospital.',
    time: '42 mins ago',
    badge: 'Critical'
  },
  {
    id: 'ACT-3',
    type: 'fulfilled',
    title: 'Blood Request REQ-8044 Completed',
    desc: '2 units of AB- successfully collected and transfused for Daniel Ortiz.',
    time: '1 hour ago',
    badge: 'Fulfilled'
  },
  {
    id: 'ACT-4',
    type: 'registered',
    title: 'New Verified Donor Joined',
    desc: 'Elena Rostova (B-) registered and completed health verification checklist.',
    time: '3 hours ago',
    badge: 'New Donor'
  },
  {
    id: 'ACT-5',
    type: 'hospital_verified',
    title: 'Hospital Verification Complete',
    desc: 'City General Medical Center authenticated 3 donor cross-matches.',
    time: '4 hours ago',
    badge: 'Verified'
  }
];

const INITIAL_DONATION_HISTORY = [
  {
    id: 'HIST-901',
    date: '2026-07-15',
    hospital: 'St. Jude Children & Trauma Center',
    bloodGroup: 'O-',
    units: 1,
    donationType: 'Whole Blood',
    patientImpact: 'Pediatric emergency trauma surgery',
    certificateId: 'CERT-BL-2026-7819',
    livesImpacted: 3
  },
  {
    id: 'HIST-902',
    date: '2026-04-10',
    hospital: 'Metropolitan Heart & Oncology Institute',
    bloodGroup: 'O-',
    units: 1,
    donationType: 'Whole Blood',
    patientImpact: 'Cardiovascular surgical support',
    certificateId: 'CERT-BL-2026-4421',
    livesImpacted: 3
  },
  {
    id: 'HIST-903',
    date: '2026-01-08',
    hospital: 'City General Medical Center',
    bloodGroup: 'O-',
    units: 1,
    donationType: 'Whole Blood',
    patientImpact: 'Maternity critical transfusion',
    certificateId: 'CERT-BL-2026-1109',
    livesImpacted: 3
  },
  {
    id: 'HIST-904',
    date: '2025-10-18',
    hospital: 'North Star Memorial Hospital',
    bloodGroup: 'O-',
    units: 1,
    donationType: 'Platelets (Apheresis)',
    patientImpact: 'Leukemia patient chemotherapy support',
    certificateId: 'CERT-BL-2025-9982',
    livesImpacted: 2
  }
];

const INITIAL_HOSPITALS = [
  'St. Jude Children & Trauma Center',
  'City General Medical Center',
  'St. Mary Specialized Women & Care',
  'Metropolitan Heart & Oncology Institute',
  'North Star Memorial Hospital',
  'Apex Regional Trauma Network',
  'Evergreen Community Blood Bank'
];

// Demonstration live metrics
const PLATFORM_STATS = {
  registeredDonors: 14820,
  successfulConnections: 8410,
  completedRequests: 7930,
  avgResponseMins: 18,
  activeHospitals: 142,
  citiesCovered: 38
};
