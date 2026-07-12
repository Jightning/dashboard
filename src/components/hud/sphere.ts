/**
 * Shared sphere geometry for the HUD network visuals (NeuralCore decorative
 * sphere + NetworkSphere interactive graph). Pure math, no React — so both
 * components place points the same way and stay filter-free.
 */

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface Projected {
    /** Screen coords in the 0–100 viewBox. */
    cx: number;
    cy: number;
    /** 0 (far side of sphere) .. 1 (near side) — drives depth fade. */
    depth: number;
}

/** Fixed tilt so we look slightly down at the globe. */
export const DEFAULT_PITCH = -0.32;

/** Even point distribution on a unit sphere via the golden-angle lattice. */
export function fibonacciSphere(n: number): Vec3[] {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const out: Vec3[] = [];
    for (let i = 0; i < n; i++) {
        const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2; // 1 -> -1
        const rad = Math.sqrt(Math.max(0, 1 - y * y));
        const th = i * golden;
        out.push({ x: Math.cos(th) * rad, y, z: Math.sin(th) * rad });
    }
    return out;
}

/** Rotate a unit vector by `yaw` about Y then `pitch` about X, project ortho. */
export function project(
    v: Vec3,
    yaw: number,
    radius: number,
    pitch = DEFAULT_PITCH,
): Projected {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const rx = v.x * cy + v.z * sy;
    const rz0 = -v.x * sy + v.z * cy;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const ry = v.y * cp - rz0 * sp;
    const rz = v.y * sp + rz0 * cp;
    return { cx: 50 + rx * radius, cy: 50 - ry * radius, depth: (rz + 1) / 2 };
}

function normalize(v: Vec3): Vec3 {
    const m = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function cross(a: Vec3, b: Vec3): Vec3 {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
    };
}

// --- Quaternion orientation (trackball rotation for NetworkSphere) ----------

export interface Quat {
    x: number;
    y: number;
    z: number;
    w: number;
}

export const IDENTITY_QUAT: Quat = { x: 0, y: 0, z: 0, w: 1 };

/** Unit quaternion for a rotation of `angle` (rad) about the given axis. */
export function quatFromAxisAngle(
    ax: number,
    ay: number,
    az: number,
    angle: number,
): Quat {
    const h = angle / 2;
    const s = Math.sin(h);
    return { x: ax * s, y: ay * s, z: az * s, w: Math.cos(h) };
}

/** Hamilton product a·b (apply b, then a). */
export function quatMul(a: Quat, b: Quat): Quat {
    return {
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    };
}

export function quatNormalize(q: Quat): Quat {
    const m = Math.hypot(q.x, q.y, q.z, q.w) || 1;
    return { x: q.x / m, y: q.y / m, z: q.z / m, w: q.w / m };
}

/** Rotate a vector by a unit quaternion: v + 2w(q×v) + 2 q×(q×v). */
export function rotateVec(v: Vec3, q: Quat): Vec3 {
    const tx = 2 * (q.y * v.z - q.z * v.y);
    const ty = 2 * (q.z * v.x - q.x * v.z);
    const tz = 2 * (q.x * v.y - q.y * v.x);
    return {
        x: v.x + q.w * tx + (q.y * tz - q.z * ty),
        y: v.y + q.w * ty + (q.z * tx - q.x * tz),
        z: v.z + q.w * tz + (q.x * ty - q.y * tx),
    };
}

/** Project a unit vector oriented by quaternion `q` into the 0–100 viewBox. */
export function projectQuat(v: Vec3, q: Quat, radius: number): Projected {
    const r = rotateVec(v, q);
    return { cx: 50 + r.x * radius, cy: 50 - r.y * radius, depth: (r.z + 1) / 2 };
}

/**
 * A neighboring unit vector offset from `hub` in its tangent plane by
 * (du, dv). Used to cluster a hub's satellites around it on the sphere.
 */
export function tangentOffset(hub: Vec3, du: number, dv: number): Vec3 {
    // Reference axis not parallel to the hub (avoid degenerate cross at poles).
    const ref: Vec3 =
        Math.abs(hub.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const t1 = normalize(cross(ref, hub));
    const t2 = cross(hub, t1); // already unit (hub, t1 orthonormal)
    return normalize({
        x: hub.x + t1.x * du + t2.x * dv,
        y: hub.y + t1.y * du + t2.y * dv,
        z: hub.z + t1.z * du + t2.z * dv,
    });
}
