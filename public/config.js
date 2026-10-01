// The Computer Science department, 7th floor. Shared by the browser pages and the Node server.
//
// Map coordinates follow the hand-drawn sketch (viewBox 2000 x 950).
// GPS values come from the floor survey (floor7-survey D1 database).
//
// How a GPS fix becomes a spot on the map (see geo.js):
//   1. farther than `campusRadius` from the lift lobby        -> off campus
//   2. teacher not confirmed on floor 7                       -> ground layer (entry gate) or "in the university"
//   3. within `centre.radius` of the lift lobby               -> nearest surveyed centre-block landmark
//   4. farther than `building` from the corridor line         -> "in the university" (not in this building)
//   5. otherwise: distance ALONG the right-block corridor     -> a point on the drawn corridor
//   6. within a landmark's own `radius` (m)                   -> snapped onto that landmark
(function (root) {
  const CAMPUS = {
    name: 'The Professors’ Map',
    subtitle: 'Seventh Floor · Computer Science Department',
    map: { width: 2000, height: 950 },

    origin: { lat: 22.5894437, lng: 88.4865923 },   // 7th-floor lift lobby (surveyed, ±14 m)
    campusRadius: 160,       // m from the lift lobby that still counts as "in the university"
    maxAcc: 35,              // fixes worse than this (m) don't move anyone
    floorHoldHours: 4,       // "on the 7th floor" expires after this unless refreshed
    roomPinMinutes: 45,      // a QR room check-in holds this long unless GPS says otherwise

    // Right-block corridor: lift lobby -> RB 708 door. `stops` maps metres-along-the-corridor
    // (measured by GPS) to x on the drawn corridor, so the sketch doesn't need to be to scale.
    rb: {
      end: { lat: 22.5902261, lng: 88.4869696 },    // RB 708 (surveyed, ±7 m)
      stops: [[0, 1373], [52.1, 910], [94.8, 252]],  // lifts, water purifier, RB 708
      top: [[252, 297], [1415, 287]],                // corridor walls on the map
      bottom: [[254, 342], [1415, 328]],
      minX: 205, maxX: 1400,
    },
    lb: { top: [[1415, 287], [1885, 365]], bottom: [[1415, 328], [1866, 411]] },

    centre: { radius: 16 },  // m around the lift lobby treated as the centre block
    building: { side: 35, ends: 25 }, // m off the corridor line (sideways / past either end) that is no longer this building

    // Drawn areas. `key` = letter on the map + room QR codes. `spot` = where footprints stand.
    rooms: [
      // top row (north side of the corridor on the sketch)
      { id: 'rb708',   key: 'A', name: 'RB 708',        kind: 'classroom', rect: [200, 184, 304, 265] },
      { id: 'rb706',   key: 'C', name: 'RB 706',        kind: 'classroom', rect: [330, 181, 434, 262] },
      { id: 'empty1',            name: 'Empty space',   kind: 'empty',     rect: [476, 186, 644, 290] },
      { id: 'boys',    key: 'I', name: 'Boys’ / Student Toilet', kind: 'toilet', rect: [597, 194, 638, 258] },
      { id: 'rb704',   key: 'E', name: 'RB 704',        kind: 'classroom', rect: [652, 201, 757, 282] },
      { id: 'rb702',   key: 'G', name: 'RB 702',        kind: 'classroom', rect: [773, 205, 878, 286] },
      { id: 'purifier',key: 'J', name: 'Water Purifier', kind: 'purifier', rect: [889, 212, 931, 272] },
      { id: 'empty2',            name: 'Empty space',   kind: 'empty',     rect: [937, 210, 1040, 290] },
      { id: 'stairs',  key: 'K', name: 'Stairs',        kind: 'stairs',    rect: [1003, 215, 1037, 268] },
      { id: 'stoilet', key: 'L', name: 'Staff Toilet',  kind: 'toilet',    rect: [1045, 223, 1073, 285] },
      { id: 'staff1',  key: 'M', name: 'Staff Room',    kind: 'staff',     rect: [1078, 221, 1171, 286] },
      { id: 'staff2',  key: 'N', name: 'Staff Room',    kind: 'staff',     rect: [1177, 220, 1282, 284] },
      // bottom row
      { id: 'rb707',   key: 'B', name: 'RB 707',        kind: 'classroom', rect: [214, 372, 319, 453] },
      { id: 'rb705',   key: 'D', name: 'RB 705',        kind: 'classroom', rect: [354, 368, 459, 448] },
      { id: 'empty3',            name: 'Empty space',   kind: 'empty',     rect: [468, 347, 625, 442] },
      { id: 'rb703',   key: 'F', name: 'RB 703',        kind: 'classroom', rect: [634, 356, 739, 436] },
      { id: 'rb701',   key: 'H', name: 'RB 701',        kind: 'classroom', rect: [764, 354, 904, 442] },
      { id: 'empty4',            name: 'Empty space',   kind: 'empty',     rect: [920, 351, 1038, 431] },
      { id: 'staff3',  key: 'O', name: 'Staff Room',    kind: 'staff',     rect: [1049, 348, 1163, 413] },
      { id: 'hod',     key: 'P', name: 'HOD Office',    kind: 'hod',       rect: [1170, 352, 1294, 452], spot: [1204, 322] }, // drawn big: the Headquarters
      // centre block
      { id: 'lab708',  key: 'Q', name: 'Lab 708',       kind: 'lab', rect: [1296, 178, 1344, 210] },
      { id: 'lab2',    key: 'R', name: 'Lab 2',         kind: 'lab', rect: [1296, 214, 1344, 246] },
      { id: 'smlab',   key: 'S', name: 'Staff Room Lab / Meeting Room', kind: 'lab', rect: [1296, 250, 1344, 282] },
      { id: 'mba1',    key: 'T', name: 'MBA Lab 1',     kind: 'lab', rect: [1382, 178, 1430, 210] },
      { id: 'mba2',    key: 'U', name: 'MBA Lab 2',     kind: 'lab', rect: [1382, 214, 1430, 246] },
      { id: 'mba3',    key: 'V', name: 'MBA Lab 3',     kind: 'lab', rect: [1382, 250, 1430, 282] },
      { id: 'lifts',   key: 'W', name: 'Lifts',         kind: 'lifts', rect: [1316, 340, 1430, 384], spot: [1373, 318] },
      { id: 'endfloor',          name: 'End of the floor', kind: 'end', rect: [81, 177, 190, 457] },
      // ground floor
      { id: 'gate',    key: 'X', name: 'College Entry Gate', kind: 'gate', layer: 'ground', rect: [1305, 458, 1445, 526], spot: [1375, 536] },
    ],

    // Surveyed GPS spots. `radius` (m): a fix this close snaps straight onto the landmark.
    // `centre: true` landmarks compete for fixes near the lift lobby (nearest one wins).
    landmarks: [
      { id: 'lifts7',    room: 'lifts',  lat: 22.5894437, lng: 88.4865923, radius: 5, centre: true, label: 'By the lifts' },
      { id: 'lab708',    room: 'lab708', lat: 22.5893967, lng: 88.4867008, radius: 3, centre: true },
      { id: 'lab2',      room: 'lab2',   lat: 22.5894085, lng: 88.4866860, radius: 3, centre: true },
      { id: 'meeting',   room: 'smlab',  lat: 22.5894106, lng: 88.4866357, radius: 3, centre: true, label: 'Meeting room (Staff Room Lab)' },
      { id: 'hod',       room: 'hod',    lat: 22.5893947, lng: 88.4866462, radius: 2, centre: true, label: 'HOD Office' }, // surveyed ±63 m: weak
      { id: 'staffmid',  spot: [1177, 294], lat: 22.5894004, lng: 88.4867030, radius: 2, centre: true, label: 'By the staff rooms' },
      { id: 'stairs',    room: 'stairs', lat: 22.5894700, lng: 88.4867387, radius: 4, centre: true },
      { id: 'purifier',  room: 'purifier', lat: 22.5897949, lng: 88.4869878, radius: 5 },
      { id: 'rb708',     room: 'rb708',  lat: 22.5902261, lng: 88.4869696, radius: 6 },
      // ground layer (used when a teacher is NOT confirmed on the 7th floor)
      { id: 'gate',      room: 'gate',   lat: 22.5897382, lng: 88.4864555, radius: 14, layer: 'ground' },
      { id: 'groundlift', spot: [1375, 446], lat: 22.5896032, lng: 88.4865233, radius: 7, layer: 'ground', label: 'Ground-floor lifts' },
    ],

    statuses: ['Available', 'In class', 'In a meeting', 'Office hours', 'Busy', 'Away'],
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CAMPUS;
  else root.CAMPUS = CAMPUS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
