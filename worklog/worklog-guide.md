# Worklog Verification Guide

A command sequence to verify `worklog`, with the output to expect.

The `sleep` pauses give each step a known duration: S1 takes 8 seconds for 8 points and S2 takes 12 seconds for 12 points. That makes the pace 1 second per point, so estimates come out as round numbers. Timestamps show as `HH:MM:SS`, and durations can be about 1 second off because timestamps are stored in whole seconds.

## 1. Start clean and check the plan

```
$ worklog reset
reset worklog-db from steps.md

$ worklog steps list
id  estimation  original  status  description
--  ----------  --------  ------  ------------------------------------------
S1  8           yes       todo    Scaffold the `onboard` web project ...
S2  12          yes       todo    Define the database schema ...
S3  14          yes       todo    Implement authentication ...
S4  10          yes       todo    Build the Superadmin UI ...
S5  14          yes       todo    Implement a fake email service ...
S6  16          yes       todo    Build the invitation acceptance flow ...
S7  8           yes       todo    Build the Leader team view ...
S8  18          yes       todo    Add a database dump-to-JSON tool ...

$ worklog estimate
No completed steps yet - finish at least one step to get an estimate.
```

## 2. Check that invalid commands are rejected (each exits with code 1)

```
$ worklog end S1
error: S1 is not started

$ worklog start S99
error: unknown step S99
```

## 3. S1: 8 seconds for 8 points

```
$ worklog start S1
start S1 at HH:MM:SS

$ worklog start S1
error: S1 is already started

$ sleep 8; worklog end S1
end S1 at HH:MM:SS

$ worklog estimate
Time left:  1m 32s          ← 92 points left × 1 s
Done at:    <now + 1m 32s>
```

## 4. S2: 12 seconds for 12 points, then start S3 and leave it running

```
$ worklog start S2
start S2 at HH:MM:SS

$ sleep 12; worklog end S2
end S2 at HH:MM:SS

$ worklog start S3
start S3 at HH:MM:SS

$ sleep 4; worklog estimate
Time left:  1m 16s          ← 80 points left × 1 s, minus 4 s already spent on S3
Done at:    <now + 1m 16s>
```

## 5. History and log

```
$ worklog estimate-history
timestamp            estimated clocktime
-------------------  -------------------
<S1 end time>        <S1 end + 1m 32s>
<S2 end time>        <S2 end + 1m 20s>

$ worklog log-progress list
id  timestamp            step_id  state
--  -------------------  -------  -----
1   YYYY-MM-DD HH:MM:SS  S1       start
2   YYYY-MM-DD HH:MM:SS  S1       end
3   YYYY-MM-DD HH:MM:SS  S2       start
4   YYYY-MM-DD HH:MM:SS  S2       end
5   YYYY-MM-DD HH:MM:SS  S3       start
```

## 6. Add a step that wasn't in the plan

```
$ worklog steps add S9 'Extra polish'
added S9 with estimation 12          ← average of 8+12+14+10+14+16+8+18 is 12.5, rounded to 12

$ worklog steps add S9 'Dup'
error: step S9 already exists

$ worklog steps list
id  estimation  original  status       description
--  ----------  --------  -----------  ----------------------------------
S1  8           yes       done         Scaffold the `onboard` web project ...
S2  12          yes       done         Define the database schema ...
S3  14          yes       in progress  Implement authentication ...
S4  10          yes       todo         ...
S5  14          yes       todo         ...
S6  16          yes       todo         ...
S7  8           yes       todo         ...
S8  18          yes       todo         ...
S9  12          no        todo         Extra polish

$ worklog estimate
Time left:  ~1m 2xs         ← 12 s more than before, minus the time S3 has kept running
Done at:    <now + time left>
```

## 7. Reset to the original state

```
$ worklog reset
reset worklog-db from steps.md
```

After the reset, `worklog log-progress list` shows an empty log and `worklog steps list` shows only S1–S8.
