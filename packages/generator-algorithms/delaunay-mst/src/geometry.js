const EPSILON = 1e-9;

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function circumcircle(a, b, c) {
  const ax = a.x;
  const az = a.z;
  const bx = b.x;
  const bz = b.z;
  const cx = c.x;
  const cz = c.z;

  const d =
    2 *
    (ax * (bz - cz) +
      bx * (cz - az) +
      cx * (az - bz));

  if (Math.abs(d) <= EPSILON) return null;

  const a2 = ax * ax + az * az;
  const b2 = bx * bx + bz * bz;
  const c2 = cx * cx + cz * cz;

  const centerX =
    (a2 * (bz - cz) +
      b2 * (cz - az) +
      c2 * (az - bz)) /
    d;
  const centerZ =
    (a2 * (cx - bx) +
      b2 * (ax - cx) +
      c2 * (bx - ax)) /
    d;

  const dx = centerX - ax;
  const dz = centerZ - az;

  return {
    x: centerX,
    z: centerZ,
    radiusSquared: dx * dx + dz * dz,
  };
}

function triangleContainsPointInCircumcircle(triangle, points, point) {
  const circle = circumcircle(
    points[triangle.a],
    points[triangle.b],
    points[triangle.c],
  );
  if (!circle) return false;

  const dx = point.x - circle.x;
  const dz = point.z - circle.z;
  const distanceSquared = dx * dx + dz * dz;

  return distanceSquared <= circle.radiusSquared + 1e-7;
}

export function buildDelaunayTriangulation(inputPoints) {
  if (!Array.isArray(inputPoints) || inputPoints.length < 3) {
    throw new RangeError('Delaunay triangulation requires at least 3 points');
  }

  const originalPoints = inputPoints.map((point, index) => {
    if (
      !point ||
      typeof point.x !== 'number' ||
      !Number.isFinite(point.x) ||
      typeof point.z !== 'number' ||
      !Number.isFinite(point.z)
    ) {
      throw new TypeError(`point ${index} must contain finite x/z coordinates`);
    }
    return { x: point.x, z: point.z };
  });

  const xs = originalPoints.map((point) => point.x);
  const zs = originalPoints.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;

  const points = [
    ...originalPoints,
    { x: midX - span * 32, z: midZ - span * 2 },
    { x: midX, z: midZ + span * 32 },
    { x: midX + span * 32, z: midZ - span * 2 },
  ];

  const superA = originalPoints.length;
  const superB = originalPoints.length + 1;
  const superC = originalPoints.length + 2;

  let triangles = [{ a: superA, b: superB, c: superC }];

  for (let pointIndex = 0; pointIndex < originalPoints.length; pointIndex += 1) {
    const point = points[pointIndex];
    const badTriangles = triangles.filter((triangle) =>
      triangleContainsPointInCircumcircle(triangle, points, point),
    );

    const boundaryCounts = new Map();
    for (const triangle of badTriangles) {
      for (const [a, b] of [
        [triangle.a, triangle.b],
        [triangle.b, triangle.c],
        [triangle.c, triangle.a],
      ]) {
        const key = edgeKey(a, b);
        const current = boundaryCounts.get(key);
        if (current) current.count += 1;
        else boundaryCounts.set(key, { a, b, count: 1 });
      }
    }

    const badSet = new Set(badTriangles);
    triangles = triangles.filter((triangle) => !badSet.has(triangle));

    for (const edge of boundaryCounts.values()) {
      if (edge.count !== 1) continue;
      triangles.push({
        a: edge.a,
        b: edge.b,
        c: pointIndex,
      });
    }
  }

  const finalTriangles = triangles
    .filter(
      (triangle) =>
        triangle.a < originalPoints.length &&
        triangle.b < originalPoints.length &&
        triangle.c < originalPoints.length,
    )
    .map((triangle) => ({ ...triangle }));

  const edgeMap = new Map();
  for (const triangle of finalTriangles) {
    for (const [a, b] of [
      [triangle.a, triangle.b],
      [triangle.b, triangle.c],
      [triangle.c, triangle.a],
    ]) {
      const key = edgeKey(a, b);
      if (!edgeMap.has(key)) edgeMap.set(key, { a: Math.min(a, b), b: Math.max(a, b) });
    }
  }

  const edges = [...edgeMap.values()]
    .map((edge) => {
      const left = originalPoints[edge.a];
      const right = originalPoints[edge.b];
      const dx = left.x - right.x;
      const dz = left.z - right.z;
      return {
        ...edge,
        weight: Math.hypot(dx, dz),
      };
    })
    .sort((left, right) =>
      left.weight - right.weight ||
      left.a - right.a ||
      left.b - right.b);

  return {
    triangles: finalTriangles,
    edges,
  };
}

export function buildMinimumSpanningTree(pointCount, edges) {
  if (!Number.isInteger(pointCount) || pointCount < 1) {
    throw new RangeError('pointCount must be a positive integer');
  }
  if (!Array.isArray(edges)) throw new TypeError('edges must be an array');

  const parent = Array.from({ length: pointCount }, (_, index) => index);
  const rank = Array(pointCount).fill(0);

  function find(value) {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  }

  function union(left, right) {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return false;

    if (rank[leftRoot] < rank[rightRoot]) parent[leftRoot] = rightRoot;
    else if (rank[leftRoot] > rank[rightRoot]) parent[rightRoot] = leftRoot;
    else {
      parent[rightRoot] = leftRoot;
      rank[leftRoot] += 1;
    }
    return true;
  }

  const tree = [];
  const sorted = [...edges].sort((left, right) =>
    left.weight - right.weight ||
    left.a - right.a ||
    left.b - right.b);

  for (const edge of sorted) {
    if (!union(edge.a, edge.b)) continue;
    tree.push({ ...edge });
    if (tree.length === pointCount - 1) break;
  }

  if (tree.length !== pointCount - 1) {
    throw new Error(
      `Delaunay graph is disconnected: expected ${pointCount - 1} MST edges, found ${tree.length}`,
    );
  }

  return tree;
}
