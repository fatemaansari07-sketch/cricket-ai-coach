export const SHOT_CATALOG = {
  batting: [
    { id: 'cover_drive', label: 'Cover Drive' },
    { id: 'straight_drive', label: 'Straight Drive' },
    { id: 'on_drive', label: 'On Drive' },
    { id: 'off_drive', label: 'Off Drive' },
    { id: 'cut_shot', label: 'Cut Shot' },
    { id: 'pull_shot', label: 'Pull Shot' },
    { id: 'hook_shot', label: 'Hook Shot' },
    { id: 'square_drive', label: 'Square Drive' },
    { id: 'sweep_shot', label: 'Sweep Shot' },
    { id: 'defence', label: 'Defence' },
  ],
  bowling: [
    { id: 'fast_bowling', label: 'Fast Bowling' },
    { id: 'inswinger', label: 'Inswinger' },
    { id: 'outswinger', label: 'Outswinger' },
    { id: 'yorker', label: 'Yorker' },
    { id: 'bouncer', label: 'Bouncer' },
    { id: 'off_cutter', label: 'Off Cutter' },
    { id: 'leg_cutter', label: 'Leg Cutter' },
    { id: 'spin', label: 'Spin Bowling' },
  ],
  fielding: [
    { id: 'ground_fielding', label: 'Ground Fielding' },
    { id: 'catching', label: 'Catching' },
    { id: 'diving_stop', label: 'Diving Stop' },
    { id: 'throw', label: 'Throw' },
  ],
};

export const SHOT_TYPES = Object.fromEntries(Object.entries(SHOT_CATALOG).map(([k, v]) => [k, v.map(x => x.label)]));
export function getShotLabel(category, idOrLabel) {
  return SHOT_CATALOG[category]?.find(x => x.id === idOrLabel || x.label === idOrLabel)?.label || idOrLabel || '';
}
