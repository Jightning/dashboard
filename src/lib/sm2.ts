/** Anki-style grades: 0 Again, 3 Hard, 4 Good, 5 Easy. */
export type Grade = 0 | 3 | 4 | 5;

export interface ReviewState {
    ease: number;
    intervalDays: number;
    reps: number;
}

const DAY = 86_400_000;

/** Classic SM-2. Failures requeue in 10 minutes and reset the streak. */
export function reviewCard(
    state: ReviewState,
    grade: Grade,
    now: number,
): ReviewState & { dueAt: number } {
    if (grade < 3) {
        return {
            ease: Math.max(1.3, state.ease - 0.2),
            intervalDays: 0,
            reps: 0,
            dueAt: now + 10 * 60_000,
        };
    }
    const ease = Math.max(
        1.3,
        state.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
    );
    const intervalDays =
        state.reps === 0
            ? 1
            : state.reps === 1
              ? 6
              : Math.round(state.intervalDays * ease);
    return {
        ease,
        intervalDays,
        reps: state.reps + 1,
        dueAt: now + intervalDays * DAY,
    };
}
