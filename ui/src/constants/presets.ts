export interface Preset {
  id: string;
  label: string;
  equation: string;
  description: string;
  category: string;
}

export const PRESET_LIST: Preset[] = [
  // Linear Equations
  {
    id: 'linear_basic',
    label: 'Basic Linear Equation',
    equation: '2 * x + 4 = 10',
    description: 'Solve for x in a standard two-step linear equation.',
    category: 'Linear Equations',
  },
  {
    id: 'linear_both_sides',
    label: 'Variables on Both Sides',
    equation: '3 * x + 5 = x + 13',
    description: 'Collect variables on one side and constants on the other.',
    category: 'Linear Equations',
  },
  {
    id: 'linear_negative',
    label: 'Negative Coefficients',
    equation: '-2 * x + 7 = 15',
    description: 'Practice transposing with negative multiplier coefficients.',
    category: 'Linear Equations',
  },
  {
    id: 'linear_distribution',
    label: 'Distribution Form',
    equation: '3 * (x - 2) = 18',
    description: 'Distribute the multiplication across brackets or divide both sides.',
    category: 'Linear Equations',
  },
  {
    id: 'linear_multi_step',
    label: 'Multi-Step Linear',
    equation: '5 * x - 3 + 2 * x = 4 * x + 9',
    description: 'Group like terms first to simplify the transposition process.',
    category: 'Linear Equations',
  },

  // Literal Equations
  {
    id: 'literal_slope_intercept',
    label: 'Slope-Intercept Formula',
    equation: 'y = m * x + b',
    description: 'The equation of a straight line, representing slope m and intercept b.',
    category: 'Literal Equations',
  },
  {
    id: 'literal_rectangle_area',
    label: 'Rectangle Area',
    equation: 'A = w * h',
    description: 'Area of a rectangle as width multiplied by height.',
    category: 'Literal Equations',
  },
  {
    id: 'literal_rectangle_perimeter',
    label: 'Rectangle Perimeter',
    equation: 'P = 2 * l + 2 * w',
    description: 'Total distance around a rectangle of length l and width w.',
    category: 'Literal Equations',
  },
  {
    id: 'literal_simple_interest',
    label: 'Simple Interest',
    equation: 'I = P * r * t',
    description: 'Calculates interest earned over time t with principal P and rate r.',
    category: 'Literal Equations',
  },
  {
    id: 'literal_temp_c_to_f',
    label: 'Celsius to Fahrenheit',
    equation: 'F = (9 / 5) * C + 32',
    description: 'Convert temperatures from degrees Celsius to Fahrenheit.',
    category: 'Literal Equations',
  },

  // Fractions & Ratios
  {
    id: 'fraction_linear',
    label: 'Linear with Fractions',
    equation: '(x + 4) / 2 = y - 1',
    description: 'Clear denominators by multiplying both sides of the equation.',
    category: 'Fractions & Ratios',
  },
  {
    id: 'fraction_proportion',
    label: 'Basic Proportion',
    equation: 'a / b = c / d',
    description: 'Standard ratio equivalence. Practice cross-multiplication transpositions.',
    category: 'Fractions & Ratios',
  },
  {
    id: 'fraction_direct_variation',
    label: 'Direct Variation Ratio',
    equation: 'y / x = k',
    description: 'Represents a constant ratio relationship between y and x.',
    category: 'Fractions & Ratios',
  },
  {
    id: 'fraction_average',
    label: 'Three-Value Average',
    equation: 'A = (x + y + z) / 3',
    description: 'The arithmetic mean of three values x, y, and z.',
    category: 'Fractions & Ratios',
  },
  {
    id: 'fraction_coefficients',
    label: 'Fractional Coefficients',
    equation: '(2 / 3) * x + 5 = 11',
    description: 'Linear equation containing non-integer variable multipliers.',
    category: 'Fractions & Ratios',
  },

  // Quadratics & Roots
  {
    id: 'quadratic_basic_solve',
    label: 'Quadratic Equation',
    equation: 'x^2 - 4 = 0',
    description: 'Practice taking square roots or factoring difference of squares.',
    category: 'Quadratics & Roots',
  },
  {
    id: 'quadratic_factored',
    label: 'Factored Quadratic',
    equation: '(x + 2) * (x + 3) = 0',
    description: 'Utilize the zero-product property to find solutions.',
    category: 'Quadratics & Roots',
  },
  {
    id: 'quadratic_diff_of_squares',
    label: 'Difference of Squares',
    equation: 'x^2 - y^2 = (x - y) * (x + y)',
    description: 'Classical algebraic identity for factoring quadratic polynomials.',
    category: 'Quadratics & Roots',
  },
  {
    id: 'quadratic_radical',
    label: 'Simple Radical',
    equation: 'sqrt(x) + 2 = 5',
    description: 'Isolate the square root term then raise both sides to power 2.',
    category: 'Quadratics & Roots',
  },
  {
    id: 'quadratic_circle',
    label: 'Circle Equation',
    equation: 'x^2 + y^2 = r^2',
    description: 'Standard Cartesian equation of a circle centered at the origin.',
    category: 'Quadratics & Roots',
  },

  // Classical Physics
  {
    id: 'physics_force',
    label: "Newton's Second Law",
    equation: 'F = m * a',
    description: 'Force equals mass multiplied by acceleration.',
    category: 'Classical Physics',
  },
  {
    id: 'physics_mass_energy',
    label: 'Mass-Energy Equivalence',
    equation: 'E = m * c^2',
    description: "Einstein's mass-energy relation using the speed of light c.",
    category: 'Classical Physics',
  },
  {
    id: 'physics_kinetic_energy',
    label: 'Kinetic Energy',
    equation: 'K = (1 / 2) * m * v^2',
    description: 'Energy of a body of mass m in motion with velocity v.',
    category: 'Classical Physics',
  },
  {
    id: 'physics_acceleration',
    label: 'Constant Acceleration',
    equation: 'v = u + a * t',
    description: 'Final velocity v given initial velocity u, acceleration a, and time t.',
    category: 'Classical Physics',
  },
  {
    id: 'physics_ohms_law',
    label: "Ohm's Law",
    equation: 'V = I * R',
    description: 'Voltage V equals current I multiplied by electrical resistance R.',
    category: 'Classical Physics',
  },
  {
    id: 'physics_wave',
    label: 'Wave Speed Equation',
    equation: 'v = f * L',
    description: 'Wave velocity v as frequency f multiplied by wavelength L.',
    category: 'Classical Physics',
  },

  // Thermodynamics & Chemistry
  {
    id: 'thermo_gas_law',
    label: 'Ideal Gas Law',
    equation: 'P * V = n * R * T',
    description: 'Equation of state relating pressure, volume, gas constant, and temperature.',
    category: 'Thermodynamics & Chemistry',
  },
  {
    id: 'thermo_density',
    label: 'Density Formula',
    equation: 'D = m / V',
    description: 'Mass D of a substance per unit of volume V.',
    category: 'Thermodynamics & Chemistry',
  },
  {
    id: 'thermo_boyles_law',
    label: "Boyle's Law",
    equation: 'P_1 * V_1 = P_2 * V_2',
    description: 'Gas pressure and volume are inversely proportional at constant temperature.',
    category: 'Thermodynamics & Chemistry',
  },
  {
    id: 'thermo_specific_heat',
    label: 'Specific Heat Energy',
    equation: 'Q = m * c * d',
    description: 'Heat energy absorbed Q given mass m, specific heat c, and temp delta d.',
    category: 'Thermodynamics & Chemistry',
  },

  // Geometry
  {
    id: 'geom_pythagorean',
    label: 'Pythagorean Theorem',
    equation: 'a^2 + b^2 = c^2',
    description: 'Relation between legs a, b and hypotenuse c in a right-angled triangle.',
    category: 'Geometry',
  },
  {
    id: 'geom_circle_area',
    label: 'Area of Circle',
    equation: 'A = pi * r^2',
    description: 'The area A of a circle with radius r (using constant pi).',
    category: 'Geometry',
  },
  {
    id: 'geom_cylinder_volume',
    label: 'Volume of Cylinder',
    equation: 'V = pi * r^2 * h',
    description: 'Calculates volume V given base radius r and height h.',
    category: 'Geometry',
  },
  {
    id: 'geom_sphere_volume',
    label: 'Volume of Sphere',
    equation: 'V = (4 / 3) * pi * r^3',
    description: 'Volume V of a sphere of radius r.',
    category: 'Geometry',
  },
];
