import { NextRequest, NextResponse } from 'next/server';
import { 
  generateValidMoves, 
  getSimplificationForPath, 
  areEquationsEquivalent, 
  autoSimplify, 
  parseEquation, 
  equationToString,
  Equation,
  serializeEquation,
  deserializeEquation,
  SerializedEquation,
  getNodeByPath,
  tryDistribution,
  HIGH_SCHOOL_IDENTITIES,
  matchPattern,
  instantiatePattern,
  replaceNodeAtPath,
  tryExpressAsPower
} from 'math-engine';
import * as math from 'mathjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'sync-state') {
      const { eqStr, serializedEq, sourcePath } = body;
      
      let eq: Equation;
      if (serializedEq) {
        eq = deserializeEquation(serializedEq);
      } else {
        eq = parseEquation(eqStr);
      }
      
      // 1. Traverse the AST to get all node paths
      const allNodePaths: string[] = [];
      const traversePaths = (node: math.MathNode, prefix: string) => {
        if (!node) return;
        allNodePaths.push(prefix);
        const children = 'args' in node ? (node as any).args : ('content' in node ? [(node as any).content] : []);
        children.forEach((child: math.MathNode, index: number) => {
          if (child) traversePaths(child, `${prefix}/${index}`);
        });
      };
      traversePaths(eq.lhs, 'lhs');
      traversePaths(eq.rhs, 'rhs');

      // 2. Get active paths (nodes that can be moved/transformed)
      const activePaths = new Set<string>();
      allNodePaths.forEach((path) => {
        try {
          const moves = generateValidMoves(eq, path);
          if (Object.keys(moves).length > 0) {
            activePaths.add(path);
          }
        } catch {}
      });

      // 3. Get reducible paths (nodes that can be simplified, distributed, or rewritten using algebraic identities)
      interface RawReduction {
        path: string;
        simplified: Equation;
        serialized: SerializedEquation;
        type: 'reduce' | 'distribute' | 'identity';
        label?: string;
      }
      const rawReductions: RawReduction[] = [];

      allNodePaths.forEach((path) => {
        // Try standard simplification/distribution
        try {
          const simplified = getSimplificationForPath(eq, path);
          if (simplified) {
            const node = getNodeByPath(eq, path);
            const isDist = !!tryDistribution(node);
            rawReductions.push({
              path,
              simplified,
              serialized: serializeEquation(simplified),
              type: isDist ? 'distribute' : 'reduce'
            });
          }
        } catch {}

        // Try high-school algebraic identity matches
        try {
          const node = getNodeByPath(eq, path);
          for (const rule of HIGH_SCHOOL_IDENTITIES) {
            const bindings = matchPattern(rule.sourcePattern, node);
            if (bindings) {
              const instantiated = instantiatePattern(rule.targetPattern, bindings);
              const newEq = replaceNodeAtPath(eq, path, instantiated);
              if (areEquationsEquivalent(eq, newEq)) {
                rawReductions.push({
                  path,
                  simplified: newEq,
                  serialized: serializeEquation(newEq),
                  type: 'identity',
                  label: rule.name
                });
              }
            }
          }
        } catch {}

        // Try expressing perfect power constants (e.g. 9 -> 3^2, 8 -> 2^3)
        try {
          const node = getNodeByPath(eq, path);
          const powerForm = tryExpressAsPower(node);
          if (powerForm) {
            const newEq = replaceNodeAtPath(eq, path, powerForm);
            if (areEquationsEquivalent(eq, newEq)) {
              const exponent = ((powerForm as math.OperatorNode).args[1] as math.ConstantNode).value;
              const label = exponent === 2 ? 'Express as Square' : 'Express as Cube';
              rawReductions.push({
                path,
                simplified: newEq,
                serialized: serializeEquation(newEq),
                type: 'identity',
                label
              });
            }
          }
        } catch {}
      });

      // Deduplicate reducible paths: if multiple paths result in the same simplified equation,
      // choose the single most specific/relevant path to avoid overlapping simplify handles.
      // We use a strict mathematical canonicalizer to group functionally identical equations
      // (e.g. y * 2 - 6 and 2 * y - 6) together under a unified normal form key.
      const reduciblePaths: Record<
        string,
        {
          equation: SerializedEquation;
          type: 'reduce' | 'distribute' | 'identity';
          label?: string;
        }[]
      > = {};
      const simplifiedToStringMap = new Map<string, RawReduction[]>();

      const getCanonicalKey = (eqVal: Equation): string => {
        return equationToString(eqVal);
      };

      rawReductions.forEach((red) => {
        const eqStrKey = getCanonicalKey(red.simplified);
        if (!simplifiedToStringMap.has(eqStrKey)) {
          simplifiedToStringMap.set(eqStrKey, []);
        }
        simplifiedToStringMap.get(eqStrKey)!.push(red);
      });

      simplifiedToStringMap.forEach((reds, _) => {
        reds.sort((a, b) => {
          const nodeA = getNodeByPath(eq, a.path);
          const nodeB = getNodeByPath(eq, b.path);
          
          const isOpA = nodeA.type === 'OperatorNode' || nodeA.type === 'FunctionNode';
          const isOpB = nodeB.type === 'OperatorNode' || nodeB.type === 'FunctionNode';
          
          // Prefer Operator/Function nodes over leaf Constant/Symbol nodes
          if (isOpA && !isOpB) return -1;
          if (!isOpA && isOpB) return 1;
          
          // Prefer deeper paths (more specific subtrees)
          return b.path.split('/').length - a.path.split('/').length;
        });
        
        const bestRed = reds[0];
        if (!reduciblePaths[bestRed.path]) {
          reduciblePaths[bestRed.path] = [];
        }
        reduciblePaths[bestRed.path].push({
          equation: bestRed.serialized,
          type: bestRed.type,
          label: bestRed.label
        });
      });

      // 4. Get target paths (valid drop targets for selected sourcePath)
      const targetPaths: Record<string, SerializedEquation> = {};
      if (sourcePath) {
        try {
          const moves = generateValidMoves(eq, sourcePath);
          delete moves[sourcePath];
          Object.keys(moves).forEach((k) => {
            targetPaths[k] = serializeEquation(moves[k]);
          });
        } catch {}
      }

      return NextResponse.json({
        activePaths: Array.from(activePaths),
        reduciblePaths,
        targetPaths,
      });
    }

    if (action === 'validate-equivalent') {
      const { eqStr1, eqStr2 } = body;
      const eq1 = parseEquation(eqStr1);
      const eq2 = parseEquation(eqStr2);
      const equivalent = areEquationsEquivalent(eq1, eq2);
      return NextResponse.json({ equivalent });
    }

    if (action === 'auto-simplify') {
      const { eqStr } = body;
      const eq = parseEquation(eqStr);
      const simplified = autoSimplify(eq);
      return NextResponse.json({ simplifiedEqStr: equationToString(simplified) });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
