import type { Scenario, Transaction } from './types';

/** Deterministic, entirely fictional fixtures. No external profile or image service. */
export function seedScenario(name = 'Studio demo', now = new Date()): Scenario {
  let state = 2057;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const dateAt = (daysAgo: number) => {
    const d = new Date(now);
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };
  const colors = ['#aa8aff', '#61d6b1', '#f3bb72', '#80bfff', '#f28da7', '#bab7ff', '#8ee0cd', '#f2da8f'];
  const creators = [
    { id: 'creator-1', name: 'Sofia Morgan', handle: '@sofia.m', color: colors[0] },
    { id: 'creator-2', name: 'Luna Hart', handle: '@lunahart', color: colors[1] },
    { id: 'creator-3', name: 'Chloe Reed', handle: '@chloe.r', color: colors[2] },
    { id: 'creator-4', name: 'Ava Brooks', handle: '@ava.b', color: colors[3] },
  ].map((c, i) => ({ ...c, avatar: '', addedAt: dateAt(180 + i * 16) }));
  const employeeNames = [
    'Alex Rivera',
    'Jamie Parker',
    'Sam Bennett',
    'Riley Quinn',
    'Jordan Ellis',
    'Casey Lane',
    'Taylor Blake',
    'Morgan Avery',
  ];
  const employees = employeeNames.map((employeeName, i) => ({
    id: `employee-${i + 1}`,
    name: employeeName,
    role: i < 2 ? 'Team lead' : 'Chatter',
    color: colors[i],
    hoursWorked: 80 + i * 8,
    messagesSent: 1500 + i * 271,
    conversionRate: Number((8.5 + i * 1.2).toFixed(1)),
  }));
  const first = [
    'Oliver',
    'Noah',
    'Ethan',
    'Leo',
    'Max',
    'Henry',
    'Daniel',
    'Lucas',
    'Theo',
    'Oscar',
    'Jack',
    'Charlie',
    'George',
    'Arlo',
    'Finn',
    'Louis',
    'Ben',
    'James',
    'Eli',
    'Hugo',
    'Felix',
    'Miles',
    'Arthur',
    'Jude',
    'Adam',
  ];
  const last = ['West', 'Hill', 'Stone', 'Green', 'Cole', 'Reid', 'Fox', 'Gray', 'Wells', 'King'];
  const tags = ['VIP', 'New fan', 'Engaged', 'PPV buyer', 'Regular'];
  const fans = Array.from({ length: 250 }, (_, i) => ({
    id: `fan-${i + 1}`,
    creatorId: creators[i % 4].id,
    name: `${first[i % first.length]} ${last[Math.floor(i / first.length)]}`,
    username: `@${first[i % first.length].toLowerCase()}_${i + 101}`,
    avatar: '',
    joinedAt: dateAt(5 + Math.floor(random() * 145)),
    status: (i % 11 === 0 ? 'expired' : i % 5 === 0 ? 'free' : i % 3 === 0 ? 'renewed' : 'paid') as
      'paid' | 'free' | 'expired' | 'renewed',
    tags: [tags[i % tags.length], ...(i % 9 === 0 ? ['High value'] : [])],
    notes: i % 6 === 0 ? 'Prefers friendly updates. All profile information is fictional.' : '',
    unread: i < 12 ? (i % 3) + 1 : 0,
  }));
  const transactions: Transaction[] = Array.from({ length: 1000 }, (_, i) => {
    const transactionDay = dateAt(i % 90);
    const eligibleFans = fans.filter((fan) => fan.joinedAt <= transactionDay);
    const fan = eligibleFans[Math.floor(random() * eligibleFans.length)];
    const categoryRoll = random();
    const category: Transaction['category'] =
      categoryRoll < 0.2
        ? 'subscription'
        : categoryRoll < 0.6
          ? 'message'
          : categoryRoll < 0.8
            ? 'ppv'
            : 'tip';
    const minimum = category === 'subscription' ? 9.99 : category === 'tip' ? 5 : 15;
    const amount =
      category === 'subscription'
        ? 14.99
        : Math.round((minimum + random() * (category === 'ppv' ? 135 : 65)) * 100) / 100;
    return {
      id: `transaction-${i + 1}`,
      creatorId: fan.creatorId,
      fanId: fan.id,
      employeeId: employees[i % employees.length].id,
      date: `${transactionDay}T${String(8 + (i % 14)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      category,
      amount,
    };
  });
  const messages = fans.slice(0, 18).flatMap((fan, i) => [
    {
      id: `message-${i}-1`,
      fanId: fan.id,
      direction: 'in' as const,
      text: [
        'Hey! How is your day going?',
        'Loved the latest update. Thank you!',
        'Any new content coming this week?',
      ][i % 3],
      date: `${dateAt(i % 3)}T10:12:00.000Z`,
      ppvAmount: 0,
      image: '',
    },
    {
      id: `message-${i}-2`,
      fanId: fan.id,
      direction: 'out' as const,
      text: 'So good to hear from you! I have something special planned ✨',
      date: `${dateAt(i % 3)}T10:15:00.000Z`,
      ppvAmount: 0,
      image: '',
    },
    {
      id: `message-${i}-3`,
      fanId: fan.id,
      direction: 'in' as const,
      text: [
        'Sounds great, looking forward to it!',
        'You always make my day 😊',
        'Can you tell me a little more?',
      ][i % 3],
      date: `${dateAt(i % 3)}T10:18:00.000Z`,
      ppvAmount: 0,
      image: '',
    },
  ]);
  return {
    version: 1,
    id: 'scenario-demo',
    name,
    creators,
    employees,
    fans,
    transactions,
    messages,
    campaigns: creators.map((creator, i) => ({
      id: `campaign-${i + 1}`,
      creatorId: creator.id,
      name: ['Autumn collection', 'Welcome series', 'Weekend moments', 'VIP appreciation'][i],
      status: i === 2 ? 'paused' : 'active',
      budget: 200 + i * 120,
      clicks: 456 + i * 130,
      conversions: 24 + i * 7,
    })),
    shifts: Array.from({ length: 14 }, (_, i) => ({
      id: `shift-${i + 1}`,
      employeeId: employees[i % employees.length].id,
      date: dateAt(-(i % 7)),
      start: i % 2 === 0 ? '09:00' : '16:00',
      end: i % 2 === 0 ? '15:00' : '22:00',
    })),
    scripts: [
      {
        id: 'script-1',
        title: 'A warm welcome',
        content: 'Hey! So happy you are here. Tell me a little about yourself ✨',
      },
      {
        id: 'script-2',
        title: 'New release',
        content: 'A little something special is ready for you. Want a sneak peek?',
      },
      { id: 'script-3', title: 'Welcome back', content: 'I missed hearing from you. How have you been?' },
    ],
    smartLists: [
      { id: 'list-1', name: 'VIP audience', tag: 'VIP' },
      { id: 'list-2', name: 'New subscribers', tag: 'New fan' },
      { id: 'list-3', name: 'PPV enthusiasts', tag: 'PPV buyer' },
    ],
    links: creators.map((_, i) => ({
      id: `link-${i + 1}`,
      campaignId: `campaign-${i + 1}`,
      label: ['Instagram bio', 'Welcome promotion', 'Weekend campaign', 'VIP newsletter'][i],
      url: `https://example.com/demo/campaign-${i + 1}`,
      clicks: 120 + i * 72,
    })),
    charts: {},
    overrides: {},
    widgetOrder: ['total', 'net', 'messages', 'subscribers'],
    settings: { agencyName: 'Velvet Studio', currency: 'USD', theme: 'dark' },
  };
}
