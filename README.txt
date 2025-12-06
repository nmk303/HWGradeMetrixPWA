# HW GradeMetrix

An advanced web calculator designed for students to calculate weighted grades, track academic progress, and check progression requirements. This tool is specifically adapted for the Heriot-Watt/Aktobe student grading system.

Developed by Nurbay Matsalaev.

## Features

*   **Weighted Grade Calculation:** Add multiple assessments with individual weightings to calculate a final course percentage and letter grade.
*   **Academic Tracking:** Save course results to track your performance over multiple semesters and academic years.
*   **Overall WAM:** Automatically calculates your Weighted Average Mark (WAM) for the academic year.
*   **Progression Requirements:** Checks your saved grades against university requirements for progressing to the next year of study.
*   **Data Management:** Export all your saved data to an Excel file for backup or import data from a file.
*   **PWA Support:** Install the calculator as a desktop or mobile application for easy offline access.

## Running the Application

### For Quick Use

You can open the `index.html` file directly in your web browser. This is the simplest way to use the calculator, but it does not support app installation.

### To Install as an App (Recommended)

To get a dedicated app icon, you should install it as a Progressive Web App (PWA). This requires serving the files from a local web server.

1.  **Serve the files:** A simple method is to use the "Live Server" extension in a code editor like Visual Studio Code. Right-click `index.html` and select "Open with Live Server".
2.  **Open in browser:** Once the server is running, it will open the provided local address (e.g., `http://127.0.0.1:5500`).
3.  **Install:** Look for an "Install" icon in your browser's address bar and click it. The application will be added to your desktop or home screen.

## How to Use

1.  **Enter Course Details:** Fill in the `Course Name`, `Credits`, `Semester`, and `Academic Year` in the "COURSE/MODULE DETAILS" section.

2.  **Add Assessments:**
    *   In the "ASSESSMENT COMPONENTS" section, click `+ Add New Assessment` to add a field for an exam or coursework.
    *   For each assessment, enter the `Full Marks` (maximum possible score), your `Obtained Mark`, and its `Weighting (%)` in the final grade.
    *   The "Final Percentage" and "Final Letter" grades will update automatically as you enter data.

3.  **Save Your Results:**
    *   Click the `Save Results` button to store the course data.
    *   Saved courses will appear in the "COURSE HISTORY & STATISTICS" section.
    * 
4.  **Track Overall Progress:**
    *   The "OVERALL YEAR RESULTS" card shows your `Overall Weighted Average Mark (WAM)` based on all courses saved for the selected academic year.
    *   The "Year Progression Requirements" box will show if you meet the criteria to advance to your next year of study.

## Data Management

*   **Export Excel Data:** Click button to save all your course history into a single `.xlsx` file.
*   **Import Data:** To import files from last saved folder. 

*   Send email nm3002@hw.ac.uk for feedback.
