// Midwest scenic entry point. The former monolithic midwest.js remains loaded
// only for animation/update utilities used elsewhere; none of its accumulated
// legacy scenery builders are invoked from this module.
import { buildChicagoSouthland } from './midwest/chicago.js';
import { buildRuralIndiana, buildRuralI74 } from './midwest/rural.js';
import { buildIndianapolis } from './midwest/indianapolis.js';
import { buildCincinnati } from './midwest/cincinnati.js';

export { updateWindFarm, updateDMS, updateChicago } from './midwest.js';

export function buildMidwest(scene, registry) {
  buildChicagoSouthland(scene, registry); // I-294 → I-80/94 Borman → I-65
  buildRuralIndiana(scene, registry);      // I-65 farms, logistics, wind farms
  buildIndianapolis(scene, registry);      // I-865/I-465 bypass → I-74
  buildRuralI74(scene, registry);          // Shelbyville, Greensburg, SE hills
  buildCincinnati(scene, registry);        // I-74 → I-75 north → Mason
}

