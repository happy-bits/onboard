# Worklog

`worklog` is a small command-line tool for tracking progress on the steps in `steps.md` and estimating how much time is left. It is a single Python 3 script (standard library only) that stores its data in the SQLite database `worklog-db`, next to the script.

Run it as `./worklog <command>` from this folder, or link it onto your PATH:

```sh
ln -s "$PWD/worklog" /usr/local/bin/worklog
```

## Data

| Table | Columns | Contents |
|-------|---------|----------|
| `steps` | `id`, `description`, `estimation`, `in_original_plan` | The plan. Loaded from the table in `steps.md`; `estimation` is relative effort in points. |
| `log-progress` | `id`, `timestamp`, `step_id`, `state` | One row per `start` or `end` event. |

The database is created from `steps.md` the first time any command runs.

## Commands

| Command | What it does |
|---------|--------------|
| `worklog start S1` | Logs that work on S1 started. Fails if S1 is unknown or already started. |
| `worklog end S1` | Logs that work on S1 ended. Fails if S1 is not started. |
| `worklog steps list` | Lists the steps with estimation, whether they were in the original plan, and status (`todo`, `in progress`, `done`). |
| `worklog steps add S9 'Description'` | Adds a step that wasn't in the original plan. Its estimation is the average of the existing steps, rounded. |
| `worklog log-progress list` | Shows every start/end event in time order. |
| `worklog estimate` | Shows the estimated time left and the clock time when the work should be done. |
| `worklog estimate-history` | Shows, for each finished step, the finish time that would have been estimated at that moment. |
| `worklog reset` | Deletes the database and rebuilds it from `steps.md`, with an empty log. |

A step can be started and ended more than once, for example after a break; all the time counts.

## How the estimate works

1. **Pace:** the time spent on finished steps divided by their total estimation points, giving seconds per point.
2. **Time left:** each unfinished step's points multiplied by the pace. For a step that is in progress, the time already spent on it is subtracted.
3. **Finish time:** the current time plus the time left.

Before any step is finished there is no pace yet, so `estimate` says it can't estimate.

Example: S1 (8 points) took 8 minutes, so the pace is 1 minute per point. With 92 points left, the estimate is 92 minutes.

`estimate-history` repeats this calculation at each `end` event, using only the log entries up to that point.

## Limitation

`estimate-history` uses the current list of steps for every past point, because `steps` has no "added at" time. A step added later is therefore included in earlier estimates too.

## See also

`worklog-guide.md` has a command sequence to verify the tool, with the expected output for each command.
