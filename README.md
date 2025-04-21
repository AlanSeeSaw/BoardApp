# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

# Product Development Operations Process
*Internal Document - Process Proposal, v1.0*

## Goals

- **Focus on Priority:** Ensure the engineering team stays focused on highest priority business objectives.
- **Limit WIP:** Reduce thrash by limiting work in progress and emphasize "stop starting and start finishing" to get things "all the way" done.
- **Deliver Value:** Provide value to end customers more frequently.
- **Prioritization Transparency:** Streamline and provide transparency into the prioritization process, helping the entire team make decisions in the company's best interest.
- **Team Empowerment:** Help the team better understand "why" they are performing tasks, increase cross-team learning opportunities, and empower the engineering team.
  > "One of the things I've said for many years is that if you're just using your engineers to code, you're only getting about half their value." - Marty Cagan, SVPG
- **Process Improvement:** Improve the development process to help set expectations regarding project timelines and budget.

## Equal Priority Objectives

1. **Juggle new development and Production support:**
   - Maintain existing production customer satisfaction (stay on top of bugs and react quickly to emergencies)
   - Ensure ongoing new feature releases focused on outcome over output

## Process Overview

1. Issues are created by anyone/everyone on the team
2. Emergency issues are immediately prioritized (skip the line) and move through an emergency issue process
3. Other issues enter a dynamic prioritization queue (DPQ)
4. When team capacity allows, issue(s) are reviewed and prioritized from the DPQ and moved to a prioritized queue
5. Team members assign themselves issues from the prioritized queue
6. Issues proceed through normal SDLC (design, doing, testing, done)

## Quick Overview Flowchart

```
Creation &         ┌─────────────────┐
Prioritization     │ Issue created   │
                   │ by anyone       │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐      ┌─────────────────┐
                   │ Is it an        │ Yes  │ No Prioritization│
                   │ emergency?      ├─────►│ Needed          │
                   └────────┬────────┘      │                 │
                            │ No            └────────┬────────┘
                            ▼                        │
                   ┌─────────────────┐               │
                   │ DPQ             │               │
                   └────────┬────────┘               │
                            │                        │
                            ▼                        │
                   ┌─────────────────┐               │
                   │ Is there team   │ No            │
                   │ capacity?       │◄──────────────┘
                   └────────┬────────┘
                            │ Yes
                            ▼
                   ┌─────────────────┐
                   │ Issues in DPQ   │
                   │ reviewed for    │
                   │ next business   │
                   │ priority        │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ Next issue(s)   │
                   │ proceeds through│
                   │ SDLC            │
                   └─────────────────┘
```

## Priority Statuses

An issue can only have one of three priority statuses:

1. **Emergency** - skips the queue, gets triaged immediately as:
   - It can wait until the next AM stand up meeting
   - Fire alarm needs to be pulled - immediate attention needed
2. **Normal** - FIFO or as prioritized during DPQ issue grooming
3. **Date-Sensitive** - Specific date will be considered during DPQ grooming

## Issue Types

Issues are classified into one of 3 simple types:

1. **Bug** - Something in existing production not working as intended OR something that came out of QA/UAT testing
2. **Task** (includes sub-task) - Request that needs to be fulfilled or Support related issue
3. **Feature** - New feature or enhancement providing business/customer value

## Team and Capacity

Current Primary Development Team (5 people):
- React Dev 1
- React Dev 2
- QA Engineer
- Full Stack/Team Lead
- BE Dev

### Capacity Management

A primary goal is to establish limits on work in progress to achieve maximum flow from prioritized to done.

**Proposal:**
- Only 1 issue in "Doing" at a time per developer
- When developer moves an issue from doing to QA/UAT Testing, they can:
  1. Pull from prioritized queue to Planning (max 2 issues: 1 in planning, 1 in QA)
  2. Help with QA on other issues
  3. Pay down tech debt (improve test coverage, system telemetry, documentation, refactoring)
- Total Dev Max capacity = (5 devs × 2 max issues) - (# of issues in "Doing")

### Example Capacity Calculation

- Dev 1 and Dev 2 each have 1 issue in "Doing" 
- Dev 3, Dev 4 and Dev 5 each have issues in QA
- Max Capacity = 5 × 2 - 2 = 8
  - Dev3, Dev4, Dev5 allowed up to 2 each (2×3 = 6)
  - Dev1, Dev2 restricted to their one issue in "Doing" (1×2 = 2)
  - Total: 6 + 2 = 8

## Process Flow

### Scenario 1: We have 5 available slots
```
DPQ            | Prioritized    | Design        | Doing         | Testing       | Done
(Unlimited)    | (Max = 5)      | (Max 5)       | (Max 5)       | (Max 2)       | (No limit)
---------------|----------------|---------------|---------------|---------------|----------------
bugA           | bug65          | ______        | ______        | ______        | bug3
taskB          | taskH          | ______        | ______        | ______        |
featureX       | taskR          | ______        | ______        | ______        |
taskZ          | bug3           | ______        | ______        | ______        |
bug88          |                | ______        | ______        | ______        |
feature9       |                |               |               |               |
bugW           |                |               |               |               |
taskY          |                |               |               |               |
```

### Scenario 2: We have no available slots
```
DPQ            | Prioritized    | Design        | Doing         | Testing       | Done
(Unlimited)    | (Max = 5)      | (Max 3)       | (Max 5)       | (Max 4)       | (No limit)
Availability=0 | Availability=0 | Availability=2| Availability=3| Availability=0|
---------------|----------------|---------------|---------------|---------------|----------------
taskB          | bug65          | taskM         | feature 7     | taskH         | bug3
bugX           | _____          | bug45         | _____         | taskR         |
bug88          | _____          | bugA          | _____         | _____         |
bugW           | _____          | _____         | _____         | _____         |
New issues...  | _____          | task9         | _____         | _____         |
               |                | taskZ         |               |               |
               |                | taskY         |               |               |
```

### Scenario 3: With Expedite/Emergency Lane
```
                 | Prioritized    | Design        | Doing         | Testing       | Done
-----------------|----------------|---------------|---------------|---------------|----------------
Expedite Lane    | Critical34     |               |               |               |
-----------------|----------------|---------------|---------------|---------------|----------------
DPQ              | [Bug Slot] bugA| bug65         | taskR         | taskH         | bug3
(Unlimited)      | [Task] taskW   | taskZ         | _____         | _____         |
Availability=0   | [Task] task9   | taskY         | _____         | _____         |
                 | [Task] task43  | _____         | _____         | _____         |
-----------------|----------------|---------------|---------------|---------------|----------------
```

## Emergency Definition

An emergency issue is one that:
- Is causing the company to lose money
- Is preventing a customer from doing their work
- Is preventing a CDI Health team member from performing their expected daily responsibilities

When an issue is escalated to emergency status, it stops the flow and may cause work in progress to stop, creating churn and impacting deadlines and expectations.

## Benefits

- **Improved predictability and SLAs:** By limiting WIP and tracking issue completion times, we can establish average timeframes for different issue types
- **Developer Benefits:**
  - No more individual issue estimation
  - Time tracking potentially replaced with diligent issue tracking

## Proposed Board

```
DPQ → Prioritized → Design → Coding (Doing) → Code Review → QA → Ready For UAT → UAT → Ready For Release → Done
```

### Definition of Done by Column

- **Prioritized:** Done when business sets priority and slot is available
- **Design:** Done when dev is assigned and pulls into Design when there is capacity
- **Coding (Doing):** Done when acceptance criteria is written and mockups (if appropriate) are provided
- **Code Review:** Done when developer has confirmed acceptance criteria has been met
- **QA:** Another peer dev has reviewed and accepted
- **Done:** When it is in the production environment and customers are using it

## Technical Implementation

### Kanban Board Structure

The application implements a Kanban board with the following columns:

```
DPQ → Prioritized → Design → Coding (Doing) → Code Review → QA → Ready For UAT → UAT → Ready For Release → Done
```

### Key Components

- **KanbanBoard**: Main container component for the entire board
- **Column**: Represents a single column in the board (e.g., "DPQ", "Coding", etc.)
- **Card**: Represents an issue/task that can be moved between columns
- **IssueForm**: Form for creating and editing issues

### State Management

The Kanban board uses React Context API for state management, storing:
- Issues/cards and their current statuses
- Column definitions and limits
- User assignments
- Priority levels

### Features

- Drag and drop interface for moving cards between columns
- Filtering by issue type, assignee, and priority
- Emergency lane for high-priority issues
- Visual indicators for column capacity limits
- Issue tracking with detailed metrics

### Usage

To create a new issue:
1. Click the "New Issue" button
2. Fill in the required fields (title, description, type, etc.)
3. Submit the form to add it to the DPQ column

To move an issue:
1. Drag the card to the desired column
2. Alternatively, use the card's context menu to select a new status

### Development

The board component structure follows:

```
KanbanBoard/
├── Board.tsx - Main container component
├── Column.tsx - Individual column component
├── Card.tsx - Issue card component
├── IssueForm.tsx - Form for creating/editing issues
├── contexts/
│   ├── BoardContext.tsx - Context for board state
│   └── UserContext.tsx - Context for user information
└── hooks/
    ├── useDragAndDrop.ts - Custom hook for drag and drop
    └── useIssueFilters.ts - Custom hook for filtering issues
```