export type SuperagentLook = {
  id: 'nova-visor' | 'solar-strike' | 'atlas-guard' | 'prism-pulse';
  codename: string;
  icon: string;
  imageUrl: string;
  palette: {
    primary: string;
    secondary: string;
  };
};

export const SUPERAGENT_LOOKS: SuperagentLook[] = [
  {
    id: 'nova-visor',
    codename: 'Nova Sentinel',
    icon: 'IconSparkles',
    imageUrl: '/superagents/nova-sentinel.png',
    palette: {
      primary: '#8B5CF6',
      secondary: '#22D3EE',
    },
  },
  {
    id: 'solar-strike',
    codename: 'Solar Vector',
    icon: 'IconSettingsAutomation',
    imageUrl: '/superagents/solar-vector.png',
    palette: {
      primary: '#F97316',
      secondary: '#14B8A6',
    },
  },
  {
    id: 'atlas-guard',
    codename: 'Atlas Guardian',
    icon: 'IconCpu',
    imageUrl: '/superagents/atlas-guardian.png',
    palette: {
      primary: '#0F766E',
      secondary: '#B45309',
    },
  },
  {
    id: 'prism-pulse',
    codename: 'Prism Pulse',
    icon: 'IconRobot',
    imageUrl: '/superagents/prism-pulse.png',
    palette: {
      primary: '#DB2777',
      secondary: '#2563EB',
    },
  },
];

const hashSeed = (seed: string) => {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

export const pickSuperagentLook = (seed: string): SuperagentLook => {
  const hash = hashSeed(seed);

  return SUPERAGENT_LOOKS[hash % SUPERAGENT_LOOKS.length];
};
