/**
 * Lunar destinations & discovery landmarks.
 *
 * Coordinates and facts are real lunar science (NASA / USGS data).
 * Positions are in the procedural world's local units — each destination
 * sits in its own region of the 400 × 400 world (see terrain.js).
 *
 * `spawn` is where Juliet arrives; `lookAt` is where she first looks.
 */

export const DESTINATIONS = [
  {
    id: 'tranquility',
    name: 'Sea of Tranquility',
    latin: 'Mare Tranquillitatis',
    coords: '8.5° N · 31.4° E',
    tagline: 'Where humanity first walked on another world.',
    description:
      'A vast, dark basalt plain in the Moon’s near side. On 20 July 1969, Apollo 11’s Lunar Module Eagle touched down here — the first crewed landing in history. The ground is so still that the astronauts’ footprints are expected to survive for millions of years.',
    facts: [
      'Apollo 11 landed here on 20 July 1969 — Armstrong and Aldrin spent 21.5 hours on the surface.',
      'The mare’s basalt is roughly 3.9 billion years old.',
      'With no wind or water, footprints in the regolith can last for millions of years.',
    ],
    spawn: { x: -122, z: -128, lookX: -100, lookZ: -100 },
  },
  {
    id: 'copernicus',
    name: 'Copernicus Crater',
    latin: 'Crater Copernicus',
    coords: '9.7° N · 20.1° W',
    tagline: 'A colossal impact scar with terraced walls.',
    description:
      'One of the largest and best-preserved craters on the Moon — 93 km wide and nearly 4 km deep, with terraced inner walls and a dramatic central peak. Its bright ejecta rays are visible from orbit, and it is young by lunar standards at roughly 800 million years old.',
    facts: [
      '93 km across — wider than the Grand Canyon is deep.',
      'Its central peak rises about 1.2 km above the crater floor.',
      'Formed roughly 800 million years ago by an asteroid about 1 km wide.',
    ],
    spawn: { x: 92, z: -82, lookX: 100, lookZ: -100 },
  },
  {
    id: 'tycho',
    name: 'Tycho Crater',
    latin: 'Crater Tycho',
    coords: '43.3° S · 11.4° W',
    tagline: 'The brightest crater on the Moon, rays and all.',
    description:
      'Tycho is the Moon’s most brilliant crater — 86 km wide and surrounded by a spectacular system of bright rays that stretch more than 1,500 km across the surface. At about 108 million years old, it is a youngster by lunar standards, and its ejecta reached all the way to Earth.',
    facts: [
      'Its rays stretch over 1,500 km — some of the longest on the Moon.',
      'Formed about 108 million years ago, young by lunar standards.',
      'Apollo 17 astronauts collected samples from Tycho ejecta in 1972.',
    ],
    spawn: { x: -82, z: 44, lookX: -100, lookZ: 100 },
  },
  {
    id: 'southpole',
    name: 'Lunar South Pole',
    latin: 'Polus Lunaris Australis',
    coords: '89° S · 0° E',
    tagline: 'Rugged highlands, eternal shadow, hidden ice.',
    description:
      'The Moon’s south pole is a rugged mountainous region where some crater floors have not seen sunlight in billions of years. Those permanently shadowed craters are cold enough to trap water ice — confirmed by NASA’s LCROSS mission in 2009 — and this region is the target of NASA’s Artemis programme to return astronauts to the Moon.',
    facts: [
      'Some crater floors here have been in permanent shadow for billions of years.',
      'In 2009, NASA’s LCROSS impactor confirmed water ice in Cabeus crater.',
      'NASA’s Artemis programme aims to return astronauts to this region.',
    ],
    spawn: { x: 54, z: 126, lookX: 100, lookZ: 100 },
  },
]

export const LANDMARKS = [
  {
    id: 'apollo11',
    destination: 'tranquility',
    name: 'Apollo 11 Landing Site',
    position: [-100, -100],
    description:
      'Here, on 20 July 1969, the Lunar Module Eagle settled onto the Sea of Tranquility. Neil Armstrong and Buzz Aldrin became the first humans to walk on another world, while Michael Collins orbited above in the Command Module Columbia.',
    facts: [
      'Armstrong’s first step was broadcast live to an estimated 600 million viewers.',
      'The crew collected 21.5 kg of lunar samples.',
      'A laser retroreflector left by Apollo 11 is still used to measure the Moon’s distance today.',
    ],
  },
  {
    id: 'footprints',
    destination: 'tranquility',
    name: 'Footprints in the Regolith',
    position: [-88, -90],
    description:
      'The lunar surface has no wind and no water, so nothing erases what is written on it. A footprint pressed into the dust here could outlast every civilisation that has ever looked up at the Moon.',
    facts: [
      'Regolith is the Moon’s dusty soil — sharp and abrasive, unlike Earth’s sand.',
      'Micrometeorites have pulverised the surface over billions of years.',
      'The dust is so fine it clings to everything — astronauts called it “gunpowder”.',
    ],
  },
  {
    id: 'copernicus-rim',
    destination: 'copernicus',
    name: 'Copernicus Crater Rim',
    position: [100, -57],
    description:
      'Standing on the rim of Copernicus, you are looking into a wound 93 km wide and nearly 4 km deep. The terraced walls record the violence of the impact — layers of rock that slumped inward in the moments after the asteroid struck.',
    facts: [
      'The impactor was roughly 1 km wide and struck at over 60,000 km/h.',
      'Material excavated from the crater travelled up to 800 km away.',
      'Copernicus is a key reference point for dating lunar surfaces.',
    ],
  },
  {
    id: 'central-peak',
    destination: 'copernicus',
    name: 'Central Peak',
    position: [100, -100],
    description:
      'At the heart of Copernicus rises a mountain of rock that rebounded upward after the impact — a central peak about 1.2 km high. It is a frozen moment of an explosion that happened 800 million years ago.',
    facts: [
      'Central peaks form when the crater floor rebounds after impact.',
      'The peak’s rocks were lifted from deep below the surface.',
      'Similar peaks appear in craters across the Solar System.',
    ],
  },
  {
    id: 'tycho-rays',
    destination: 'tycho',
    name: 'Tycho’s Bright Rays',
    position: [-100, 139],
    description:
      'The bright streaks radiating from Tycho are streams of fresh, crushed rock blasted across the surface by the impact. They are so reflective that Tycho shines brighter than any other crater on the Moon — and its rays can be seen from Earth with binoculars.',
    facts: [
      'The ray system extends more than 1,500 km from the crater.',
      'The rays are brighter because the material is fresh and unweathered.',
      'Tycho ejecta has been found in Antarctic ice cores on Earth.',
    ],
  },
  {
    id: 'tycho-floor',
    destination: 'tycho',
    name: 'Tycho Crater Floor',
    position: [-100, 100],
    description:
      'The floor of Tycho is a sea of melted rock that pooled after the impact, now cracked into slabs and boulders. It is one of the most geologically youthful landscapes on the Moon — only about 108 million years old.',
    facts: [
      'The floor is covered in melt rock that solidified after the impact.',
      'Boulders here can be tens of metres across.',
      'Tycho is young enough that its rays still shine brightly.',
    ],
  },
  {
    id: 'shackleton',
    destination: 'southpole',
    name: 'Shackleton Crater',
    position: [100, 100],
    description:
      'Near the lunar south pole, Shackleton is a 21 km crater whose rim catches sunlight while its floor sits in permanent shadow. That strange geometry — light on the rim, eternal night inside — makes the polar craters some of the most valuable real estate in the Solar System.',
    facts: [
      'The rim receives near-constant sunlight — ideal for solar power.',
      'The floor has been shadowed for billions of years.',
      'Shackleton is named after Ernest Shackleton, the Antarctic explorer.',
    ],
  },
  {
    id: 'cabeus-ice',
    destination: 'southpole',
    name: 'Cabeus Water Ice',
    position: [114, 114],
    description:
      'In 2009, NASA deliberately crashed the LCROSS spacecraft into Cabeus crater near the south pole. The impact plume revealed water ice — the first confirmation that the Moon’s shadowed craters hold frozen water, a resource future explorers could one day use.',
    facts: [
      'LCROSS struck Cabeus on 9 October 2009.',
      'The plume contained water, and traces of other volatile compounds.',
      'Water ice could one day support lunar bases and rocket fuel.',
    ],
  },
  {
    id: 'artemis',
    destination: 'southpole',
    name: 'Artemis Base Camp',
    position: [86, 114],
    description:
      'NASA’s Artemis programme plans to return astronauts to the Moon for the first time since 1972 — and the south pole is the destination. A future base here would use the region’s sunlight, shadowed ice, and proximity to Earth.',
    facts: [
      'Artemis aims to land the first woman and first person of colour on the Moon.',
      'The south pole offers near-constant sunlight on high ridges.',
      'A lunar base here could serve as a gateway to Mars.',
    ],
  },
]

export const TOTAL_LANDMARKS = LANDMARKS.length

export function destinationById(id) {
  return DESTINATIONS.find((d) => d.id === id) || DESTINATIONS[0]
}
