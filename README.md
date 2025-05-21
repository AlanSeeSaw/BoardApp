# BoardApp

This is a Kanban-style task management app using React and Firebase. It helps us track tasks through different stages.

## Core Idea

-   A visual board with columns (like `To Do`, `Doing`, `Done` - though ours are more specific to our dev process).
-   You can drag and drop tasks (cards) between columns.
-   Create, edit, and manage tasks.

## Tech Stack

-   **Frontend:** React, TypeScript
-   **Backend & DB:** Firebase (Firestore, Cloud Functions)
-   **State Management:** React Context API

## Getting Up and Running

Here's how to get the project running on your local machine and how to deploy changes.

### 1. Prerequisites

-   **Node.js:** Make sure you have a recent LTS version. Download from [nodejs.org](https://nodejs.org/).
-   **npm:** Comes with Node.js.
-   **Firebase CLI:** If you don't have it, install it globally:
    ```bash
    npm install -g firebase-tools
    ```
    Then log in:
    ```bash
    firebase login
    ```

### 2. Installation & Setup

1.  **Clone the repo** (if you haven't already):
    ```bash
    git clone <your-repository-url>
    cd BoardApp
    ```

2.  **Install project dependencies:**
    ```bash
    npm install
    ```

3.  **Firebase Setup:**
    *   Make sure you have access to the Firebase project for this app.
    *   Copy `.env.example` to a new file named `.env` (it's in the root of the project).

### 3. Running Locally

-   **Start the development server:**
    ```bash
    npm start
    ```
    This will usually open the app at [http://localhost:3000](http://localhost:3000). It auto-reloads when you save changes, and you'll see lint errors in your terminal.

### 4. Building & Deploying to Firebase Hosting

1.  **Build the app for production:**
    ```bash
    npm run build
    ```
    This creates an optimized `build/` folder with all the static assets.

2.  **Deploy to Firebase Hosting:**
    ```bash
    firebase deploy --only hosting
    ```
    This command uploads the contents of your `build/` folder to Firebase Hosting. Make sure you're in the project root directory and logged into the correct Firebase account (`firebase login`).

## Project Structure Quick Guide

-   `public/`: Static files like `index.html`.
-   `src/`: All the React app code.
    -   `components/`: UI components.
    -   `hooks/`: Custom React hooks (where a lot of the app logic lives).
    -   `services/`: Files that talk directly to Firebase.
    -   `App.tsx`: Main app layout and routing.
-   `functions/`: Firebase Cloud Functions (our backend serverless stuff). Each folder inside is a separate function.
-   `.firebaserc`: Links this local project to your Firebase project.
-   `firebase.json`: Config for Firebase hosting, Firestore, Functions.

## How We Interact with the Database

We use Firebase Firestore. The general idea is:
-   **Hooks (`src/hooks/`)** manage UI state and local changes (optimistic updates).
-   **Service functions (`src/services/`)** are called by hooks to actually save data to Firebase.

For the nitty-gritty details on this, check out **[DB Interactions.md](DB%20Interactions.md)**.

## Cloud Functions (Backend Stuff)

If you need to write backend logic (like complex data processing or scheduled tasks), it goes into Firebase Cloud Functions in the `functions/` directory.
-   To deploy functions: `firebase deploy --only functions`
-   Remember to `cd functions` and `npm install` if you add new dependencies for them.

## Tests

-   Run tests with:
    ```bash
    npm test
    ```

## Original Create React App Notes

This project was bootstrapped with Create React App. For more on CRA scripts like `eject`, see the [CRA docs](https://facebook.github.io/create-react-app/docs/getting-started). For React itself, see the [React docs](https://reactjs.org/).