import { capitalCase } from 'change-case';
import { byFullname } from './models';
import {
  BuildSettings,
  FrontAndRearSettings,
  FrontAndRearWithUnits,
  SettingsForm,
  TuneSettings,
  Car,
  DriveType,
} from './types';
import { addSuffix as suffixize, formatFloat } from './utils';
import { formatUnit, formatUnitHeaders } from './unitsOfMeasure';

const tableSeparator = '\n######\n';
const hr = '---';

function bold(value: string): string {
  if (!value) return value;
  return `**${value.replace(/\*\*/g, '')}**`;
}

function formatTableRow(row: string[], boldFirstCol = false) {
  const r = [...row];
  if (boldFirstCol) r[0] = bold(r[0]);
  return `|${r.join('|')}|`;
}

function formatTable(header: string[], body: string[][], boldFirstCol = false): string[] {
  const rowSeparator = [':--', '--:'];
  for (let index = 2; index < header.length; index++) {
    rowSeparator.push('--:');
  }
  return [
    formatTableRow(header.map(bold)),
    formatTableRow(rowSeparator),
    ...body.map((row) => formatTableRow(row, boldFirstCol)),
    tableSeparator,
  ];
}

function formatFrontRear(headers: string[], values: FrontAndRearSettings[], precision = 1, suffix = ''): string[] {
  const body: string[][] = [
    ['Front', ...values.map((value) => formatFloat(value.front, precision, suffix))],
    ['Rear', ...values.map((value) => formatFloat(value.rear, precision, suffix))],
  ];

  return formatTable(headers, body);
}

function formatFrontRearWithUnit(header: string, value: FrontAndRearWithUnits, precision = 1): string[] {
  const headers = [
    header,
    ...formatUnitHeaders(value.units),
  ];

  const body: string[][] = [
    ['Front', ...formatUnit(value.front, value.units, precision)],
    ['Rear', ...formatUnit(value.rear, value.units, precision)],
  ];

  return formatTable(headers, body);
}

function formatTires(tune: TuneSettings): string[] {
  return formatFrontRearWithUnit('Tires', tune.tires, 1);
}

function formatGears(tune: TuneSettings): string[] {
  const precision = 2;
  const headers = ['Gears', 'Ratio'];
  const body: string[][] = [
    ['Final Drive', parseFloat(tune.gears[0]).toFixed(precision)],
  ];
  for (let index = 1; index < tune.gears.length; index++) {
    const value = parseFloat(tune.gears[index]);
    if (!value) break;
    body.push([`${index}${suffixize(index)}`, value.toFixed(precision)]);
  }

  if (body.length === 1 && tune.gears[0] === '') return [];

  return formatTable(headers, body);
}

function formatAlignment(tune: TuneSettings): string[] {
  return formatFrontRear(['Alignment', 'Camber', 'Toe', 'Caster'], [tune.camber, tune.toe, { front: tune.caster, rear: '' }], 1, '°');
}

function formatAntiRollbars(tune: TuneSettings): string[] {
  return formatFrontRear(['ARBs', ''], [tune.arb]);
}

function formatSprings(tune: TuneSettings): string[] {
  return [
    ...formatFrontRearWithUnit('Springs', tune.springs, 1),
    ...formatFrontRearWithUnit('Ride Height', tune.rideHeight, 1),
  ];
}

function formatDamping(tune: TuneSettings): string[] {
  return formatFrontRear(['Damping', 'Rebound', 'Bump'], [tune.damping, tune.bump]);
}

function formatAero(tune: TuneSettings): string[] {
  const front = ['Front'];
  const rear = ['Rear'];
  if (tune.aero.front === '') {
    front.push('N/A', '', '');
  } else {
    front.push(...formatUnit(tune.aero.front, tune.aero.units, 1));
  }
  if (tune.aero.rear === '') {
    rear.push('N/A', '', '');
  } else {
    rear.push(...formatUnit(tune.aero.rear, tune.aero.units, 1));
  }
  return formatTable(['Aero', ...formatUnitHeaders(tune.aero.units)], [front, rear]);
}

function formatBrakes(tune: TuneSettings): string[] {
  if (!tune.brake.bias && !tune.brake.pressure) {
    return [];
  }

  return formatTable(['Brakes', '%'], [
    ['Balance', formatFloat(tune.brake.bias, 0, '%')],
    ['Pressure', formatFloat(tune.brake.pressure, 0, '%')],
  ]);
}

function isDrivetrain(value: string): value is DriveType {
  return Object.values(DriveType).includes(value as DriveType);
}

export function getDrivetrain(build: BuildSettings, stockDriveType: string): DriveType {
  // return build.conversions.drivetrain || (stockDriveType);
  if (build.conversions.drivetrain) {
    return build.conversions.drivetrain;
  }
  if (isDrivetrain(stockDriveType)) {
    return stockDriveType;
  }
  return DriveType.awd;
}

function formatDifferential(form: SettingsForm, car: Car): string[] {
  const drivetrain = getDrivetrain(form.build, car.drive);
  const header = ['Differential', 'Accel', 'Decel'];
  const front = ['Front', 'N/A', 'N/A'];
  const rear = ['Rear', 'N/A', 'N/A'];
  const center = ['Center', '', ''];
  const body: string[][] = [];

  if ([DriveType.fwd, DriveType.awd].includes(drivetrain)) {
    body.push(front);
    front[1] = formatFloat(form.tune.diff.front.accel, 0, '%');
    front[2] = formatFloat(form.tune.diff.front.decel, 0, '%');
  }

  if ([DriveType.rwd, DriveType.awd].includes(drivetrain)) {
    body.push(rear);
    rear[1] = formatFloat(form.tune.diff.rear.accel, 0, '%');
    rear[2] = formatFloat(form.tune.diff.rear.decel, 0, '%');
  }

  if (drivetrain === DriveType.awd) {
    body.push(center);
    center[1] = formatFloat(form.tune.diff.center, 0, '%');
    // ...formatTable(
    //   ['Center', ''],
    //   [['Balance', formatFloat(form.tune.diff.center, 0, '%')]],
    // ));
  }
  // const table = [
  //   '### Differential\n',
  //   ...formatTable(header, body),
  // ];

  return formatTable(header, body);
}

export function formatTune(form: SettingsForm, model: string): string[] {
  const car = byFullname[model];
  const text = [
    ...formatTires(form.tune),
    ...formatGears(form.tune),
    ...formatAlignment(form.tune),
    ...formatAntiRollbars(form.tune),
    ...formatSprings(form.tune),
    ...formatDamping(form.tune),
    ...formatAero(form.tune),
    ...formatBrakes(form.tune),
    ...formatDifferential(form, car),
  ];

  return text;
}

function formatConversions(build: BuildSettings): string[] {
  const headers = ['Conversions', ''];
  const body = [
    ['Engine', build.conversions.engine || 'Stock'],
    ['Drivetrain', build.conversions.drivetrain || 'Stock'],
  ];
  if (build.conversions.aspiration) {
    body.push(['Aspiration', build.conversions.aspiration || 'Stock']);
  }
  if (build.conversions.aspiration) {
    body.push(['Body Kit', build.conversions.bodyKit || 'Stock']);
  }
  return formatTable(headers, body);
}

function formatTiresAndRims(build: BuildSettings): string[] {
  return formatTable(['Tires And Rims', ''], [
    ['Compound', build.tiresAndRims.compound],
    ['Tire Width', `Front ${build.tiresAndRims.width.front} mm, Rear ${build.tiresAndRims.width.rear} mm`],
    ['Rim Style', `${build.tiresAndRims.rimStyle.type} ${build.tiresAndRims.rimStyle.name}`],
    ['Rim Size', `Front ${build.tiresAndRims.rimSize.front} in, Rear ${build.tiresAndRims.rimSize.rear} in`],
    ['Track Width', `Front ${build.tiresAndRims.trackWidth.front}, Rear ${build.tiresAndRims.trackWidth.rear}`],
  ]);
}

function formatAeroBuild(build: BuildSettings): string[] {
  const aero: string[][] = [];
  if (build.aeroAndAppearance.frontBumper) {
    aero.push(['Front Bumper', build.aeroAndAppearance.frontBumper]);
  }
  if (build.aeroAndAppearance.rearBumper) {
    aero.push(['Rear Bumper', build.aeroAndAppearance.rearBumper]);
  }
  if (build.aeroAndAppearance.rearWing) {
    aero.push(['Rear Wing', build.aeroAndAppearance.rearWing]);
  }
  if (build.aeroAndAppearance.sideSkirts) {
    aero.push(['Side Skirts', build.aeroAndAppearance.sideSkirts]);
  }
  if (build.aeroAndAppearance.hood) {
    aero.push(['Hood', build.aeroAndAppearance.hood]);
  }

  if (aero.length === 0) return [];

  return formatTable(['Aero and Appearance', ''], aero);
}

function formatBuildSection<T>(section: T) {
  const keys = Object.keys(section);
  return keys.map((key) => [capitalCase(key), section[key as keyof T]]);
}

export function formatBuild(build: BuildSettings): string[] {
  const text = [
    ...formatConversions(build),
    ...formatTable(['Engine', ''], formatBuildSection(build.engine)),
    ...formatTable(['Platform And Handling', ''], formatBuildSection(build.platformAndHandling)),
    ...formatTable(['Drivetrain', ''], formatBuildSection(build.drivetrain)),
    ...formatTiresAndRims(build),
    ...formatAeroBuild(build),
  ];

  return text;
}

export function generateRedditMarkdown(form: SettingsForm) {
  if (!form.model) {
    return 'A Make and Model must be selected before output can be generated';
  }
  return [
    `#${form.model}\n`,
    '## Build\n',
    ...formatBuild(form.build),
    '---\n',
    '## Tune\n',
    ...formatTune(form, form.model),
    '---\n',
    'Formatted text generated by the [Forza Open Tunes Formatter](https://ldalvik.github.io/ForzaOpenTuneFormatter/)  \n',
    'Submit bugs, feature requests, and questions on [Github](https://github.com/Ldalvik/ForzaOpenTuneFormatter/issues)',
  ].join('\n');
}
