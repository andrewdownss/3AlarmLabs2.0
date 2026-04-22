# 3AlarmLabs Self-Paced Mode PRD (Cursor-Ready)

## Overview

Self-Paced Mode is a solo command training experience built from a fully pre-authored scenario. Instead of a live instructor controlling updates, the system acts like a pre-recorded instructor by dispatching scripted events over time.

The user operates as the command officer. They receive dispatch information, review the current incident state, give radio commands, update the command board, correct any parse mistakes, and review performance at the end.

This mode is designed to give firefighters more command reps in a repeatable format focused on:

- radio communication
- unit assignment
- command board tracking
- expected tactical actions
- replayable after-action review

This PRD is designed as an extension of the current command training product direction, which already centers on radio input, command board updates, replay, and self-practice support. :contentReference[oaicite:0]{index=0}

---

## Product Goals

### Primary Goal

Allow a firefighter to run a solo, time-based command simulation without needing a live instructor.

### MVP Goals

The MVP should:

- support fully scripted self-paced scenarios
- progress scenarios automatically by time
- allow the user to give push-to-talk radio commands
- parse radio traffic into command board updates
- allow the user to manually fix improper radio parse results
- track expected actions in the background
- provide end-of-session replay and review
- support pause, restart, retry, and session completion/failure flows

### Non-Goals for MVP

The MVP should **not** include:

- dynamic fire behavior simulation
- branching scenario logic
- conditional scenario trees
- randomization
- live scoring during the scenario
- department-specific SOP/SOG grading
- multi-user self-paced sessions
- user-created self-paced scenarios

Those can come later after user feedback.

---

## Core Product Positioning

Self-Paced Mode should feel like:

- a repeatable command rep tool
- a solo training environment
- a promotional prep aid
- a way to practice becoming a better incident commander

It should **not** feel like:

- a sandbox editor
- a dynamic fire growth simulator
- a complex game with branching logic in v1

---

## User Types

### Primary Users

- firefighters preparing for promotion
- acting officers
- company officers
- firefighters looking to improve command ability
- training-minded individual users

### Secondary Users

- departments wanting self-practice options
- instructors using self-paced reps as supplemental training

### Admin User

For MVP, self-paced scenarios are created by admin only.

---

## User Stories

### Solo User

- As a firefighter, I want to run a command scenario on my own so I can get more reps.
- As a user, I want to speak radio traffic naturally so the training feels realistic.
- As a user, I want the command board to update automatically from my radio traffic.
- As a user, I want to correct board mistakes if the system parses something incorrectly.
- As a user, I want the scenario to progress automatically so I can focus on command.
- As a user, I want to review what I said and did after the scenario ends.

### Admin

- As an admin, I want to create a scripted scenario with timed updates and hazards.
- As an admin, I want to define expected actions for the scenario.
- As an admin, I want to define when assignment completion updates should fire.
- As an admin, I want to control end conditions and failure conditions.

---

## Core Experience

## Session Start

A self-paced session begins with:

- dispatch notes
- initial size-up image/state
- available apparatus/resources
- initial fire/building state
- any initial command board information if applicable

The user starts the scenario already acting as command.

### Example Start Flow

1. User selects a self-paced scenario.
2. User sees dispatch notes.
3. User sees initial image and incident state.
4. User sees starting resources/apparatus.
5. User clicks Start Scenario.
6. Scenario timer begins.
7. Scripted timeline engine begins dispatching updates.

---

## Scenario Design Model

Each self-paced scenario is:

- fully pre-authored before runtime
- fixed and scripted the same way every run
- progressed by time
- controlled by the system rather than a live instructor

### Scenario Includes

- scenario title
- scenario description
- dispatch notes
- initial image/state
- initial resources
- initial hazards/updates
- stage timeline
- timed events
- expected actions
- assignment completion rules
- end conditions
- failure conditions
- time limit

---

## Time-Based Progression

For MVP, all self-paced progression is driven by time.

### Examples

- At 1:00, show: `Heavy fire showing Side Charlie`
- At 2:30, show: `Caller reports victim trapped`
- At 4:00, show: `Water supply problem reported`
- At 5:00, if an eligible assignment was made earlier, show: `Truck 1 reports primary search complete`

### Reason for Time-Based MVP

This keeps the first version:

- predictable
- easier to author
- easier to debug
- easier for users to understand
- easier to validate with pilot users

---

## Student Interactions

During the scenario, the student can:

- view current scenario state
- view dispatch notes and updates
- use push-to-talk radio input
- submit radio traffic
- see command board updates
- manually fix improper command board entries
- pause the scenario
- restart the scenario
- retry the scenario after ending

The student cannot:

- alter the authored scenario logic
- edit scenario timeline events
- directly author new hazards or updates during the run

---

## Radio Workflow

The radio workflow should match the main product architecture and reuse the same general event structure where possible. :contentReference[oaicite:1]{index=1}

### Flow

1. User presses push-to-talk.
2. Audio is recorded.
3. Audio is stored.
4. Speech-to-text generates a raw transcript.
5. LLM/parser converts transcript into structured command data.
6. Command board updates automatically.
7. User can fix errors if the parse is wrong.
8. Event is stored for replay and review.

### Data Stored Per Radio Event

- audio reference
- raw transcript
- parsed command data
- user corrections
- timestamp
- scenario ID
- session ID

---

## Command Board

The command board is a core feature of self-paced mode.

### Goals

- reflect current resource assignments
- update automatically from radio traffic
- allow manual correction
- support after-action review
- reflect assignment completion when scripted completion events occur

### Command Board Entry Fields

Each entry may include:

- unit/resource name
- assignment
- location
- status
- last updated timestamp

### Example Entries

- Engine 1 | Division 1 | Fire attack | Operating
- Truck 1 | Division 2 | Primary search | Operating
- Engine 3 | Exterior | Water supply | Established

### Manual Correction Requirement

The user must be able to correct command board entries if parsing is incorrect.

This is required for MVP.

---

## Expected Actions

The system should track expected actions in the background.

### Purpose

Expected actions are used for:

- replay/review
- post-session feedback
- identifying missed or delayed actions

### Examples

- establish command
- assign fire attack
- assign ventilation
- assign search
- secure water supply
- react to victim report
- address worsening conditions

### MVP Rules

- expected actions exist in the scenario definition
- expected actions are tracked during the run
- expected actions are shown in end-of-session review
- expected actions do not generate live scoring during the scenario

### Important Note

Formal scoring is intentionally out of scope because performance standards can depend on department SOPs/SOGs.

---

## Assignment Completion Logic

For MVP, authored scenarios should support scripted completion results after an assignment is made.

### Example

If the user assigns Truck 1 to second-floor primary search, then after a defined delay the system can dispatch:

- `Truck 1 reports primary search on second floor completed`

### Purpose

This makes the scenario feel active and realistic without requiring dynamic branching.

### MVP Requirement

Scenario authors should be able to define:

- which assignment should trigger a completion path
- what counts as a valid assignment match
- how long after assignment the completion event should occur
- the text/content of the completion update

---

## Scenario Events

The scenario engine should support pre-authored events such as:

- stage transitions
- hazard appearances
- incident updates
- benchmark updates
- assignment completion updates
- resource updates
- time-limit warnings
- failure-state events
- end-of-scenario events

### Example Events

- Heavy fire showing Side Charlie
- Victim trapped report
- Water supply problem
- Collapse risk
- MAYDAY
- Primary all clear
- Fire attack completed
- Ventilation completed

All event content is authored ahead of time for MVP.

---

## Replay and Review

Replay is a core feature of self-paced mode and should match the broader product value of after-action review. :contentReference[oaicite:2]{index=2}

### Feedback Timing

For MVP, feedback is shown **only at the end**.

No live scoring or coaching during the scenario.

### Replay Should Show

- timeline of scripted scenario events
- timeline of user radio entries
- transcripts
- stored audio
- command board changes
- expected actions
- completed expected actions
- missed expected actions
- delayed expected actions
- final outcome

### Review Goals

The review should let the user understand:

- what stage they were operating in
- what they said
- what assignments they made
- how the board changed
- what they missed
- what they handled late
- how the scenario ended

---

## End Conditions

A self-paced scenario can end in any of the following ways:

- user marks incident under control
- all scripted events are complete
- fixed time limit is reached
- failure state is reached
- admin-defined ending condition is met

### Example Failure States

- critical expected action missed
- scenario timer exceeded
- escalation event triggers failure outcome

### Result Storage

The system should store:

- scenario outcome
- end reason
- end timestamp

---

## Session Controls

The user must be able to:

- pause the scenario
- restart the scenario
- retry the scenario after completion
- access replay/review after completion

These controls are important because the product value depends on repetition.

---

## Authoring Requirements (Admin Only for MVP)

For MVP, only admin can create self-paced scenarios.

### The Scenario Editor Must Support

- scenario title
- scenario description
- dispatch notes
- initial size-up image/state
- initial resource list
- initial hazards/updates
- stage definitions
- timed events
- expected actions
- assignment completion rules
- end conditions
- failure conditions
- time limit

### Editor Direction

This should reuse the existing scenario/state model and editor where possible, then add:

- timeline/event authoring
- expected-action configuration
- assignment-completion configuration
- end/failure condition setup

---

## State Model Reuse

Self-paced mode should reuse the existing scenario/state concepts from the current product architecture. :contentReference[oaicite:3]{index=3}

### Conceptual Model

- Instructor-led mode: instructor controls scenario state and dispatches changes
- Self-paced mode: scenario engine dispatches pre-authored state changes over time

### Key Principle

Self-paced mode should feel like:
**the same scenario system, but with timed automation replacing the live instructor**

This reduces complexity and keeps both modes aligned.

---

## Data Model Requirements

Each self-paced session should store:

- user ID
- scenario ID
- session ID
- session start time
- session end time
- current outcome
- end reason
- event timeline
- audio entries
- raw transcripts
- parsed command data
- user corrections
- command board state changes
- expected actions
- completed expected actions
- missed expected actions
- delayed expected actions
- replay metadata

### Suggested Event Types

- session_started
- timeline_event_dispatched
- radio_recorded
- transcript_created
- command_parsed
- command_board_updated
- command_board_corrected
- expected_action_completed
- expected_action_missed
- expected_action_delayed
- session_paused
- session_restarted
- session_completed
- session_failed

---

## Functional Requirements

## FR1: Scenario Selection

The user must be able to select a self-paced scenario and begin a session.

## FR2: Timed Scenario Engine

The system must dispatch scripted events over time according to the authored scenario timeline.

## FR3: Push-to-Talk Input

The user must be able to submit radio traffic using push-to-talk audio input.

## FR4: Transcript Generation

The system must create a raw transcript for each radio event.

## FR5: Command Parsing

The system must parse radio traffic into structured command data.

## FR6: Command Board Auto-Update

The command board must update automatically from parsed command data.

## FR7: Manual Correction

The user must be able to manually correct command board errors caused by parsing mistakes.

## FR8: Expected Action Tracking

The system must track expected actions in the background during the scenario.

## FR9: Assignment Completion Events

The system must support authored follow-up completion events that occur after valid assignments.

## FR10: End-of-Session Review

The system must provide replay and end-of-session review after the scenario ends.

## FR11: Session End Logic

The system must support success, failure, timeout, and manual completion end conditions.

## FR12: Pause/Restart/Retry

The system must support pause, restart, and retry actions.

## FR13: Admin Scenario Authoring

Admin must be able to author self-paced scenarios with timeline logic and expected actions.

---

## Non-Functional Requirements

### Performance

- timeline events should dispatch reliably and on time
- radio parse and board update should feel fast enough for training flow
- replay should load without major delay

### Reliability

- event timeline must persist correctly
- session events must be stored durably
- replay data must remain consistent even if the user pauses or restarts

### Usability

- user flow should feel simple and focused
- scenario state should be easy to understand at a glance
- correcting command board data should be easy and obvious

### Maintainability

- self-paced scenarios should reuse shared scenario/state structures where possible
- event types and timeline model should be extensible for future branching support

---

## MVP Acceptance Criteria

### Scenario Runtime

- user can start a self-paced scenario
- scenario shows dispatch notes, initial image/state, and available resources
- scenario progresses automatically by time
- scripted hazards and updates appear as authored

### Radio + Board

- user can submit radio traffic by push-to-talk
- transcript is generated
- command is parsed
- command board updates automatically
- user can manually correct improper parse results

### Review

- expected actions are tracked in the background
- user receives end-of-session review
- review includes timeline, transcripts, audio, board changes, and expected-action summary

### Session Outcomes

- scenario can end by success, failure, timeout, or completion
- user can pause, restart, or retry

### Authoring

- admin can create self-paced scenarios with:
  - initial state
  - timed events
  - expected actions
  - assignment completion logic
  - end conditions

---

## Future Expansion

Not part of MVP, but should be considered in the architecture:

- branching triggers
- action-based progression
- different outcomes based on user decisions
- randomization
- user-authored self-paced scenarios
- instructor-authored self-paced scenarios
- adaptive difficulty
- department SOP/SOG scoring
- personalized coaching

---

## Open Questions for Next Spec

These should be defined in the next implementation spec:

1. What exact schema should represent expected actions?
2. How should assignment matching work?
   - exact unit + assignment match
   - assignment type match
   - broader category match
3. How should delayed vs missed actions be determined?
4. What is the exact authoring UI for timeline events?
5. How should pause/restart affect timed event scheduling?
6. Should replay rebuild entirely from events or also cache derived summary data?

---

## Build Recommendation

Build the MVP as:

- a fixed scripted scenario engine
- layered on top of the existing state/event system
- with admin-authored timeline events
- with end-of-session review only

Do **not** build branching logic in v1.

The MVP should optimize for:

- repeatability
- clarity
- realistic radio interaction
- useful command review
- fast authoring and iteration
