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
  SerializedEquation
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

      // 3. Get reducible paths (nodes that can be simplified or distributed)
      const reduciblePaths: Record<string, SerializedEquation> = {};
      allNodePaths.forEach((path) => {
        try {
          const simplified = getSimplificationForPath(eq, path);
          if (simplified) {
            reduciblePaths[path] = serializeEquation(simplified);
          }
        } catch {}
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
