// Database simulation using localStorage
const DB_NAME = 'gradeCalculatorDB';
        const STORAGE_HANDLE_KEY = 'fileSystemDirectoryHandle';
        
        // Global variable for directory handle
        let rootDirectoryHandle = null;

        // ==================== UTILITY FUNCTIONS ====================

        // Sync year selectors to show imported courses
        function syncYearSelectorsAfterImport() {
            const allCourses = getCoursesFromDB();
            if (allCourses.length === 0) return;

            // Get the most recent academic year from imported courses
            const academicYears = [...new Set(allCourses.map(c => c.academicYear))];
            const mostRecentYear = academicYears.sort().reverse()[0];

            // Set all year selectors to the most recent year
            document.getElementById('academicYear').value = mostRecentYear;
            document.getElementById('semester1Year').value = mostRecentYear;
            document.getElementById('semester2Year').value = mostRecentYear;
            document.getElementById('academicYearSelect').value = mostRecentYear;
        }

        // Generate academic years from 2020-2021 to 2030-2031
        function generateAcademicYears() {
            const currentYear = new Date().getFullYear();
            const years = [];

            // Generate years from 2023-2024 to 2050-2051
            for (let year = 2023; year <= 2050; year++) {
                years.push(`${year}-${year + 1}`);
            }

            return years;
        }

        // Function to populate year dropdowns
        function populateYearSelects() {
            const years = generateAcademicYears();
            const yearSelects = [
                'academicYear',
                'semester1Year',
                'semester2Year',
                'academicYearSelect'
            ];

            yearSelects.forEach(selectId => {
                const select = document.getElementById(selectId);
                // Save current value if any
                const currentValue = select.value;
                select.innerHTML = ''; // Clear existing options

                years.forEach(year => {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    select.appendChild(option);
                });

                // Restore value or set current year
                if (years.includes(currentValue)) {
                    select.value = currentValue;
                } else {
                    const currentYear = new Date().getFullYear();
                    const currentAcademicYear = `${currentYear}-${currentYear + 1}`;
                    select.value = years.includes(currentAcademicYear) ? currentAcademicYear : years[0];
                }
            });
        }

        // ==================== FILE SYSTEM FUNCTIONS ====================

        // Check if File System Access API is supported
        function isFileSystemSupported() {
            return 'showDirectoryPicker' in window;
        }

        // Request directory access from user
        async function requestDirectoryAccess() {
            try {
                const handle = await window.showDirectoryPicker({
                    mode: 'readwrite',
                    startIn: 'documents'
                });
                rootDirectoryHandle = handle;
                showToast('Storage folder selected successfully!', 'success');
                return handle;
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Directory access error:', error);
                    showToast('Failed to access folder: ' + error.message, 'error');
                }
                return null;
            }
        }

        // Save course to file system
        async function saveCourseToFileSystem(courseData) {
            try {
                // Ensure we have directory access
                if (!rootDirectoryHandle) {
                    rootDirectoryHandle = await requestDirectoryAccess();
                    if (!rootDirectoryHandle) {
                        throw new Error('No directory selected');
                    }
                }

                // Create filename based on year and semester (e.g., "2024-25_semester_1.xlsx")
                const yearShort = courseData.academicYear.replace('-20', '-'); // "2024-2025" -> "2024-25"
                const fileName = `${yearShort}_semester_${courseData.semester}.xlsx`;

                // Read existing file or create new workbook
                let wb;
                let existingCourses = [];
                
                try {
                    const fileHandle = await rootDirectoryHandle.getFileHandle(fileName, { create: false });
                    const file = await fileHandle.getFile();
                    const arrayBuffer = await file.arrayBuffer();
                    const data = new Uint8Array(arrayBuffer);
                    wb = XLSX.read(data, { type: 'array' });
                    
                    // Read existing courses
                    if (wb.SheetNames.length > 0) {
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        existingCourses = XLSX.utils.sheet_to_json(ws);
                    }
                } catch (error) {
                    // File doesn't exist, create new workbook
                    wb = XLSX.utils.book_new();
                }

                // Prepare new course data
                const newCourse = {
                    "Course Name": courseData.courseName,
                    "Credits": courseData.credits,
                    "Semester": courseData.semester,
                    "Academic Year": courseData.academicYear,
                    "Final %": courseData.finalPercentage.toFixed(1),
                    "Final Letter": courseData.letterGrade,
                    "Classification": calculateDegreeClassification(courseData.finalPercentage),
                    "Saved Date": new Date().toLocaleDateString()
                };

                // Check if course already exists (update or add)
                const existingIndex = existingCourses.findIndex(c => 
                    c["Course Name"] === courseData.courseName
                );

                if (existingIndex >= 0) {
                    // Update existing course
                    existingCourses[existingIndex] = newCourse;
                } else {
                    // Add new course
                    existingCourses.push(newCourse);
                }

                // Create worksheet with all courses
                const ws = XLSX.utils.json_to_sheet(existingCourses);
                
                // Set column widths
                ws['!cols'] = [
                    { wch: 30 }, // Course Name
                    { wch: 10 }, // Credits
                    { wch: 10 }, // Semester
                    { wch: 15 }, // Academic Year
                    { wch: 10 }, // Final %
                    { wch: 12 }, // Final Letter
                    { wch: 20 }, // Classification
                    { wch: 12 }  // Saved Date
                ];

                // Clear existing sheets and add updated one
                wb.SheetNames = [];
                wb.Sheets = {};
                XLSX.utils.book_append_sheet(wb, ws, `Semester ${courseData.semester}`);

                // Convert to blob
                const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                // Save to file system
                const fileHandle = await rootDirectoryHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();

                // Add file path info to course data
                courseData.filePath = fileName;
                courseData.savedToFile = true;

                const action = existingIndex >= 0 ? 'updated in' : 'added to';
                showToast(`Course ${action}: ${fileName}`, 'success', 4000);
                return true;

            } catch (error) {
                console.error('File system save error:', error);
                showToast('Error saving to file: ' + error.message, 'error');
                return false;
            }
        }

        // Fallback: Export as download with suggested folder structure
        function saveCourseAsDownload(courseData) {
            try {
                // Create filename based on year and semester
                const yearShort = courseData.academicYear.replace('-20', '-'); // "2024-2025" -> "2024-25"
                const fileName = `${yearShort}_semester_${courseData.semester}.xlsx`;

                // Prepare course data
                const excelData = [{
                    "Course Name": courseData.courseName,
                    "Credits": courseData.credits,
                    "Semester": courseData.semester,
                    "Academic Year": courseData.academicYear,
                    "Final %": courseData.finalPercentage.toFixed(1),
                    "Final Letter": courseData.letterGrade,
                    "Classification": calculateDegreeClassification(courseData.finalPercentage),
                    "Saved Date": new Date().toLocaleDateString()
                }];

                const ws = XLSX.utils.json_to_sheet(excelData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, `Semester ${courseData.semester}`);
                
                XLSX.writeFile(wb, fileName);
                
                showToast(`File downloaded: ${fileName}`, 'success', 4000);
                return true;

            } catch (error) {
                console.error('Download save error:', error);
                showToast('Error downloading file: ' + error.message, 'error');
                return false;
            }
        }

        // Import from file system directory
        async function importFromFileSystem() {
            try {
                // Ensure we have directory access
                if (!rootDirectoryHandle) {
                    rootDirectoryHandle = await requestDirectoryAccess();
                    if (!rootDirectoryHandle) {
                        showToast('No directory selected. Using traditional file picker.', 'warning');
                        showFileInputDialog();
                        return;
                    }
                }

                // List all Excel files in the directory
                const files = [];
                for await (const entry of rootDirectoryHandle.values()) {
                    if (entry.kind === 'file' && (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls'))) {
                        files.push(entry);
                    }
                }

                if (files.length === 0) {
                    showToast('No Excel files found in the selected folder.', 'warning');
                    return;
                }

                // Show file selection dialog or import all files
                if (confirm(`Found ${files.length} Excel file(s). Import all?`)) {
                    let totalImported = 0;
                    let totalUpdated = 0;

                    for (const fileHandle of files) {
                        try {
                            const file = await fileHandle.getFile();
                            const result = await importSingleFile(file);
                            totalImported += result.imported;
                            totalUpdated += result.updated;
                        } catch (error) {
                            console.error(`Error importing ${fileHandle.name}:`, error);
                        }
                    }

                    showToast(`Import complete! ${totalImported} new courses, ${totalUpdated} updated.`, 'success', 4000);
                    
                    // Auto-sync year selectors to show imported data
                    syncYearSelectorsAfterImport();
                    updateAllDisplays();
                } else {
                    // Let user choose specific file
                    showFileInputDialog();
                }

            } catch (error) {
                console.error('File system import error:', error);
                showToast('Error accessing files: ' + error.message, 'error');
            }
        }

        // Import a single file and return statistics
        async function importSingleFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = function (e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        
                        if (workbook.SheetNames.length === 0) {
                            resolve({ imported: 0, updated: 0 });
                            return;
                        }

                        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet);

                        if (jsonData.length === 0) {
                            resolve({ imported: 0, updated: 0 });
                            return;
                        }

                        // Get existing database
                        const db = initDatabase();
                        let importedCount = 0;
                        let updatedCount = 0;

                        jsonData.forEach(row => {
                            // Create course object from Excel row
                            const course = {
                                id: row['ID'] || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                courseName: row['Course Name'] || '',
                                credits: parseInt(row['Credits']) || 0,
                                semester: parseInt(row['Semester']) || 1,
                                academicYear: row['Academic Year'] || '',
                                finalPercentage: parseFloat(row['Final %']) || 0,
                                finalLetter: row['Final Letter'] || '',
                                letterGrade: row['Final Letter'] || '',
                                classification: row['Classification'] || '',
                                assessments: []
                            };

                            // Skip invalid entries
                            if (!course.courseName) return;

                            // Check if course already exists
                            const existingIndex = db.courses.findIndex(c => 
                                c.courseName === course.courseName && 
                                c.academicYear === course.academicYear &&
                                c.semester === course.semester
                            );

                            if (existingIndex >= 0) {
                                db.courses[existingIndex] = course;
                                updatedCount++;
                            } else {
                                db.courses.push(course);
                                importedCount++;
                            }
                        });

                        // Save to localStorage
                        localStorage.setItem(DB_NAME, JSON.stringify(db));
                        
                        resolve({ imported: importedCount, updated: updatedCount });

                    } catch (error) {
                        reject(error);
                    }
                };

                reader.onerror = function() {
                    reject(new Error('Error reading file'));
                };

                reader.readAsArrayBuffer(file);
            });
        }

        // ==================== DATABASE FUNCTIONS ====================

        // Initialize database if not exists
        function initDatabase() {
            if (!localStorage.getItem(DB_NAME)) {
                const initialData = {
                    courses: [],
                    settings: {
                        currentYear: new Date().getFullYear()
                    }
                };
                localStorage.setItem(DB_NAME, JSON.stringify(initialData));
            }
            return JSON.parse(localStorage.getItem(DB_NAME));
        }

        // Save course to database
        function saveCourseToDB(courseData) {
            const db = initDatabase();
            courseData.id = Date.now().toString(); // Unique ID
            // Ensure semester is stored as number for consistent filtering
            courseData.semester = parseInt(courseData.semester);
            db.courses.push(courseData);
            localStorage.setItem(DB_NAME, JSON.stringify(db));
            updateAllDisplays();
            return courseData.id;
        }

        // Delete course from database
        function deleteCourseFromDB(courseId) {
            const db = initDatabase();
            const initialLength = db.courses.length;
            db.courses = db.courses.filter(course => course.id !== courseId);
            
            if (db.courses.length === initialLength) {
                showToast('Error: Course not found!', 'error');
                return;
            }
            
            localStorage.setItem(DB_NAME, JSON.stringify(db));
            updateAllDisplays();
        }

        // Get courses from database
        function getCoursesFromDB() {
            const db = initDatabase();
            return db.courses;
        }

        // ==================== DATA RETRIEVAL & CALCULATION ====================

        // Get courses by semester and year
        function getCoursesBySemester(semester, year) {
            const courses = getCoursesFromDB();
            // Convert semester to number for comparison
            const semesterNum = parseInt(semester);
            return courses.filter(course =>
                course.semester === semesterNum && course.academicYear === year
            );
        }

        // Get courses by academic year
        function getCoursesByAcademicYear(year) {
            const courses = getCoursesFromDB();
            return courses.filter(course => course.academicYear === year);
        }

        // Calculate WAM for a set of courses
        function calculateWAM(courses) {
            if (courses.length === 0) return 0;

            let totalWeightedScore = 0;
            let totalCredits = 0;

            courses.forEach(course => {
                totalWeightedScore += course.finalPercentage * course.credits;
                totalCredits += course.credits;
            });

            return totalCredits > 0 ? (totalWeightedScore / totalCredits).toFixed(1) : 0;
        }

        // Calculate degree classification based on WAM
        function calculateDegreeClassification(wam) {
            if (wam >= 70) return "First Class Honours";
            if (wam >= 60) return "Upper Second Class Honours";
            if (wam >= 50) return "Lower Second Class Honours";
            if (wam >= 40) return "Third Class Honours";
            return "Fail";
        }

        // Calculate letter grade 
        function calculateLetterGrade(percentage) {
            if (percentage >= 70) return 'A';
            if (percentage >= 60) return 'B';
            if (percentage >= 50) return 'C';
            if (percentage >= 40) return 'D';
            if (percentage >= 30) return 'E';
            return 'F';
        }

        // ==================== UI UPDATE FUNCTIONS ====================

        // Get grade description
        function getGradeDescription(letterGrade) {
            const descriptions = {
                'A': 'Excellent (70% or more)',
                'B': 'Very Good (60% to 69%)',
                'C': 'Good (50% to 59%)',
                'D': 'Satisfactory (40% to 49%)',
                'E': 'Adequate - Fail (30% to 39%)',
                'F': 'Inadequate (Below 30%)'
            };
            return descriptions[letterGrade] || 'Unknown';
        }

        // Update year requirements display
        function updateYearRequirements(yearCourses, year) {
            const requirementsContainer = document.getElementById('yearRequirements');
            const progressInfo = document.getElementById('progressInfo');

            if (yearCourses.length === 0) {
                requirementsContainer.innerHTML = '<p>No courses saved for this year.</p>';
                progressInfo.innerHTML = '';
                return;
            }

            const totalCredits = yearCourses.reduce((sum, course) => sum + course.credits, 0);
            const wam = calculateWAM(yearCourses);

            let requirements = '';
            let progress = '';
            const selectedStudyYear = parseInt(document.getElementById('studyYearSelect').value);

            const allPassD = yearCourses.every(c => ['A', 'B', 'C', 'D'].includes(c.letterGrade));
            const meetsCredits = totalCredits >= 120;

            if (selectedStudyYear === 1) { // Year 1 to Year 2
                requirements = `
                    <p><strong>Year 1 to Year 2 Requirements:</strong></p>
                    <ul>
                        <li>120 credits (8 courses)</li>
                        <li>All courses at grade D (40%) or higher</li>
                    </ul>
                `;
                progress = `
                    <p><strong>Progress Status:</strong> ${meetsCredits && allPassD ? '✅ Meets requirements' : '❌ Does not meet requirements'}</p>
                    <p>Current Credits: ${totalCredits}/120</p>
                `;
            } else if (selectedStudyYear === 2) { // Year 2 to Year 3
                requirements = `
                    <p><strong>Year 2 to Year 3 Requirements:</strong></p>
                    <ul>
                        <li>120 credits (8 courses)</li>
                        <li>All courses at grade D (40%) or higher</li>
                    </ul>
                `;
                progress = `
                    <p><strong>Progress Status:</strong> ${meetsCredits && allPassD ? '✅ Meets requirements' : '❌ Does not meet requirements'}</p>
                    <p>Current Credits: ${totalCredits}/120</p>
                `;
            } else if (selectedStudyYear >= 3) { // Year 3 to Year 4 and onwards
                requirements = `
                    <p><strong>Year 3 to Year 4 Requirements:</strong></p>
                    <ul>
                        <li>120 credits (8 courses)</li>
                        <li>Overall assessment average of 50% or above at first attempt</li>
                        <li>All courses at grade D or higher</li>
                    </ul>
                `;
                const meetsWAM = parseFloat(wam) >= 50;
                progress = `
                    <p><strong>Progress Status:</strong> ${meetsCredits && allPassD && meetsWAM ? '✅ Meets requirements' : '❌ Does not meet requirements'}</p>
                    <p>Current Credits: ${totalCredits}/120 | WAM: ${wam}%</p>
                `;
            } else {
                requirements = '<p>Select a year of study to see requirements.</p>';
            }

            requirementsContainer.innerHTML = requirements;
            progressInfo.innerHTML = progress;
        }

        // Helper function to render a list of courses
        function renderCourseList(courses, container) {
            container.innerHTML = '';
            if (courses.length === 0) {
                container.innerHTML = '<div class="empty-state">No courses found for this semester.</div>';
                return;
            }
            
            let html = '';
            courses.forEach(course => {
                const letterGrade = course.finalLetter || course.letterGrade || 'N/A';
                const percentage = course.finalPercentage !== undefined && course.finalPercentage !== null 
                    ? parseFloat(course.finalPercentage).toFixed(1) 
                    : '0.0';
                html += `
                    <div class="course-item">
                        <div>
                            <strong>${course.courseName || 'Unnamed Course'}</strong> (${course.credits || 0} credits)
                            <div class="small-text">${getGradeDescription(letterGrade)}</div>
                        </div>
                        <div class="course-actions">
                            <span style="font-weight: 600; margin-right: 8px;">${percentage}%</span>
                            <span class="grade-badge grade-${letterGrade}" style="font-weight: bold; font-size: 16px;">${letterGrade}</span>
                            <button class="delete-btn" onclick="window.handleDeleteCourse('${course.id}', '${(course.courseName || '').replace(/'/g, "\\'")}')">Delete</button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        
        // Global delete handler
        window.handleDeleteCourse = function(courseId, courseName) {
            if (confirm(`Are you sure you want to delete "${courseName}"?`)) {
                deleteCourseFromDB(courseId);
                showToast('Course deleted successfully.', 'success');
            }
        };

        // Update course history display
        function updateCourseHistory() {
            // Update semester 1 courses
            const semester1Courses = getCoursesBySemester('1', document.getElementById('semester1Year').value);
            const semester1Container = document.getElementById('semester1Courses');
            renderCourseList(semester1Courses, semester1Container);

            // Update semester 2 courses
            const semester2Courses = getCoursesBySemester('2', document.getElementById('semester2Year').value);
            const semester2Container = document.getElementById('semester2Courses');
            renderCourseList(semester2Courses, semester2Container);

            // Update year statistics
            const yearCourses = getCoursesByAcademicYear(document.getElementById('academicYearSelect').value);
            updateYearStatistics(yearCourses);
        }

        // Update year statistics
        function updateYearStatistics(courses) {
            if (courses.length === 0) {
                document.getElementById('totalCredits').textContent = '0';
                document.getElementById('averageGrade').textContent = '0%';
                document.getElementById('coursesCompleted').textContent = '0';
                document.getElementById('bestCourse').textContent = '-';
                return;
            }

            const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);
            const averageGrade = courses.reduce((sum, course) => sum + course.finalPercentage, 0) / courses.length;
            const bestCourse = courses.reduce((best, course) =>
                course.finalPercentage > best.finalPercentage ? course : best
            );

            document.getElementById('totalCredits').textContent = totalCredits;
            document.getElementById('averageGrade').textContent = averageGrade.toFixed(1) + '%';
            document.getElementById('coursesCompleted').textContent = courses.length;
            document.getElementById('bestCourse').textContent = `${bestCourse.courseName} (${bestCourse.finalPercentage}%)`;
        }

        // Update overall year results
        function updateOverallYearResults() {
            const allCourses = getCoursesFromDB();
            const currentYear = document.getElementById('academicYear').value;
            const currentYearCourses = allCourses.filter(course => course.academicYear === currentYear);

            // Check if we have at least 8 courses (120 credits minimum requirement)
            const totalCourses = currentYearCourses.length;
            const totalCredits = currentYearCourses.reduce((sum, course) => sum + course.credits, 0);

            if (totalCourses >= 8 && totalCredits >= 120) {
                // Show results only when requirements are met
                const wam = calculateWAM(currentYearCourses);
                document.getElementById('overallWAM').textContent = wam;
                document.getElementById('degreeClassification').textContent = calculateDegreeClassification(wam);
                updateYearRequirements(currentYearCourses, currentYear);
            } else {
                // Show progress towards 8 courses
                const coursesNeeded = Math.max(0, 8 - totalCourses);
                const creditsNeeded = Math.max(0, 120 - totalCredits);
                
                document.getElementById('overallWAM').textContent = '-';
                document.getElementById('degreeClassification').textContent = '-';
                
                let progressMessage = '';
                progressMessage += `<p>Courses completed: ${totalCourses}/8 (${coursesNeeded} more needed)</p>`;
                progressMessage += `<p>Credits earned: ${totalCredits}/120 (${creditsNeeded} more needed)</p>`;
                progressMessage += '<p class="small-text" style="margin-top: 10px; color: #856404;">💡 Complete 8 courses (120 credits) to see overall year results and degree classification.</p>';
                
                document.getElementById('yearRequirements').innerHTML = progressMessage;
                document.getElementById('progressInfo').innerHTML = '';
            }
        }

        // Update all displays
        function updateAllDisplays() {
            updateCourseHistory();
            updateOverallYearResults();
        }

        // Export data to Excel
        function exportToExcel() {
            try {
                const db = initDatabase();

                if (db.courses.length === 0) {
                    showToast("No data to export!", 'warning');
                    return;
                }

                // Transform data for Excel export (matching import format)
                const exportData = db.courses.map(course => ({
                    "ID": course.id || "",
                    "Course Name": course.courseName || "",
                    "Credits": course.credits || 0,
                    "Semester": course.semester || 1,
                    "Academic Year": course.academicYear || "",
                    "Final %": course.finalPercentage || 0,
                    "Final Letter": course.finalLetter || course.letterGrade || "",
                    "Classification": course.classification || ""
                }));

                // Create worksheet
                const ws = XLSX.utils.json_to_sheet(exportData);
                
                // Set column widths for better readability
                ws['!cols'] = [
                    { wch: 15 }, // ID
                    { wch: 30 }, // Course Name
                    { wch: 10 }, // Credits
                    { wch: 10 }, // Semester
                    { wch: 15 }, // Academic Year
                    { wch: 10 }, // Final %
                    { wch: 12 }, // Final Letter
                    { wch: 15 }  // Classification
                ];

                // Create workbook
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Courses");

                // Add metadata sheet
                const metaData = [{
                    "Export Date": new Date().toLocaleString(),
                    "Total Courses": db.courses.length,
                    "App Version": "HW GradeMetrix v1.0"
                }];
                const wsMeta = XLSX.utils.json_to_sheet(metaData);
                XLSX.utils.book_append_sheet(wb, wsMeta, "Export Info");

                // Generate filename with date
                const date = new Date().toISOString().split('T')[0];
                const fileName = `HW_GradeMetrix_${date}.xlsx`;

                // Save file
                XLSX.writeFile(wb, fileName);
                
                showToast(`Exported ${db.courses.length} courses successfully!`, 'success');
                console.log("Export completed successfully");

            } catch (error) {
                console.error("Export error:", error);
                showToast("Error exporting data: " + error.message, 'error');
            }

        }

        // Import data from Excel
        function importFromExcel(file) {
            if (!file) {
                showToast('Please select a file to import.', 'warning');
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    if (workbook.SheetNames.length === 0) {
                        showToast('Excel file is empty!', 'error');
                        return;
                    }

                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    if (jsonData.length === 0) {
                        showToast('No data found in Excel file!', 'warning');
                        return;
                    }

                    // Validate data structure
                    const requiredFields = ['Course Name', 'Credits', 'Semester', 'Academic Year', 'Final %'];
                    const firstRow = jsonData[0];
                    const hasRequiredFields = requiredFields.some(field => field in firstRow);

                    if (!hasRequiredFields) {
                        showToast('Invalid file format! Please use exported file from this app.', 'error');
                        return;
                    }

                    // Get existing database
                    const db = initDatabase();
                    let importedCount = 0;
                    let updatedCount = 0;

                    jsonData.forEach(row => {
                        // Create course object from Excel row
                        const course = {
                            id: row['ID'] || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                            courseName: row['Course Name'] || '',
                            credits: parseInt(row['Credits']) || 0,
                            semester: parseInt(row['Semester']) || 1,
                            academicYear: row['Academic Year'] || '',
                            finalPercentage: parseFloat(row['Final %']) || 0,
                            finalLetter: row['Final Letter'] || '',
                            letterGrade: row['Final Letter'] || '',
                            classification: row['Classification'] || '',
                            assessments: [] // Assessments are not stored in export
                        };

                        // Check if course already exists
                        const existingIndex = db.courses.findIndex(c => 
                            c.courseName === course.courseName && 
                            c.academicYear === course.academicYear &&
                            c.semester === course.semester
                        );

                        if (existingIndex >= 0) {
                            db.courses[existingIndex] = course;
                            updatedCount++;
                        } else {
                            db.courses.push(course);
                            importedCount++;
                        }
                    });

                    // Save to localStorage
                    localStorage.setItem(DB_NAME, JSON.stringify(db));
                    
                    // Auto-sync year selectors to show imported data
                    syncYearSelectorsAfterImport();
                    
                    // Update all displays
                    updateAllDisplays();
                    
                    // Show success message
                    const message = `Import successful! ${importedCount} new courses added, ${updatedCount} updated.`;
                    showToast(message, 'success', 4000);

                } catch (error) {
                    console.error('Import error:', error);
                    showToast('Error importing file: ' + error.message, 'error');
                }
            };

            reader.onerror = function() {
                showToast('Error reading file. Please try again.', 'error');
            };

            reader.readAsArrayBuffer(file);
        }

        // Function to show toast notifications
        function showToast(message, type = 'info', duration = 3000) {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;

            container.appendChild(toast);

            // Auto-remove the toast
            setTimeout(() => {
                toast.classList.add('fade-out');
                // Remove from DOM after animation
                toast.addEventListener('animationend', () => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                });
            }, duration);
        }

        // ==================== MAIN CALCULATOR LOGIC ====================

        // Counter for assessment blocks
        let assessmentCount = 0;

        // Function to add a new assessment block
        function addAssessmentBlock() {
            assessmentCount++;
            const container = document.getElementById('assessmentsContainer');

            const assessmentBlock = document.createElement('div');
            assessmentBlock.className = 'assessment-block';
            assessmentBlock.innerHTML = `
                <h3>Assessment ${assessmentCount}</h3>
                <div class="form-group">
                    <label for="assessmentName${assessmentCount}">Assessment Name</label>
                    <input type="text" id="assessmentName${assessmentCount}" placeholder="Enter assessment name">
                </div>
                <div class="horizontal-group">
                    <div class="horizontal-item">
                        <label for="fullMarks${assessmentCount}">Full Marks</label>
                        <input type="number" id="fullMarks${assessmentCount}" placeholder="Enter full marks" min="0">
                    </div>
                    <div class="horizontal-item">
                        <label for="obtainedMark${assessmentCount}">Obtained Mark</label>
                        <input type="number" id="obtainedMark${assessmentCount}" placeholder="Enter obtained mark" min="0">
                    </div>
                    <div class="horizontal-item">
                        <label for="weighting${assessmentCount}">Weighting (%)</label>
                        <input type="number" id="weighting${assessmentCount}" placeholder="Enter weighting" min="0" max="100">
                    </div>
                </div>
            `;

            container.appendChild(assessmentBlock);
        }

        // Function to calculate final grades
        function calculateGrades() {
            let totalWeightedScore = 0;
            let totalWeight = 0;

            for (let i = 1; i <= assessmentCount; i++) {
                const fullMarks = parseFloat(document.getElementById(`fullMarks${i}`).value) || 0;
                const obtainedMark = parseFloat(document.getElementById(`obtainedMark${i}`).value) || 0;
                const weighting = parseFloat(document.getElementById(`weighting${i}`).value) || 0;

                if (fullMarks > 0 && weighting > 0) {
                    const percentage = (obtainedMark / fullMarks) * 100;
                    totalWeightedScore += percentage * (weighting / 100);
                    totalWeight += weighting;
                }
            }

            // Calculate final percentage
            const finalPercentage = totalWeight > 0 ? totalWeightedScore : 0;
            document.getElementById('finalPercentage').textContent = finalPercentage.toFixed(1) + '%';



            // Calculate letter grade 
            const letterGrade = calculateLetterGrade(finalPercentage);
            document.getElementById('finalLetter').textContent = letterGrade;

            updateWeightInfo(totalWeight);
            showPassingTarget(finalPercentage, totalWeight);

            return {
                finalPercentage: finalPercentage,
                letterGrade: letterGrade
            };
        }


        function updateWeightInfo(totalWeight) {
            const weightInfo = document.getElementById('weightInfo');
            if (!weightInfo) return;

            const remainingWeight = 100 - totalWeight;

            let html = `<div class="weight-summary">
        <strong>Total Weight: ${totalWeight.toFixed(1)}%</strong>`;

            if (totalWeight < 100) {
                html += `<div class="progress-warning">
            ⚠️ Remaining weight: ${remainingWeight.toFixed(1)}% 

        </div>`;
            } else if (totalWeight === 100) {
                html += `<div class="progress-good">
            ✅ Weight distribution complete
        </div>`;
            } else {
                html += `<div class="progress-danger">
            ❌ Weight exceeded by ${(totalWeight - 100).toFixed(1)}%
        </div>`;
            }

            html += `</div>`;
            weightInfo.innerHTML = html;
        }
        function showPassingTarget(currentPercent, totalWeight) {
            const targetBox = document.getElementById('targetBox');
            if (!targetBox) return;

            const remainingWeight = 100 - totalWeight;
            let html = '';

            if (currentPercent >= 40) {
                html = `<div class="target-guaranteed">
            ✅ Course passing guaranteed (currently ${currentPercent.toFixed(1)}%)
        </div>`;
            } else if (remainingWeight > 0) {
                const neededScore = (40 - currentPercent) / (remainingWeight / 100);
                if (neededScore <= 100) {
                    html = `<div class="target-achievable">
                ⚠️ To pass this course: need ${neededScore.toFixed(1)}% on remaining ${remainingWeight}% of assessments
            </div>`;
                } else {
                    html = `<div class="target-impossible">
                ❌ Cannot pass - maximum possible: ${(currentPercent + remainingWeight).toFixed(1)}%
            </div>`;
                }
            } else {
                html = `<div class="target-failed">
            ❌ Course failed (${currentPercent.toFixed(1)}%)
        </div>`;
            }

            targetBox.innerHTML = html;
        }

        // Function to save results
        async function saveResults() {
            const courseName = document.getElementById('courseName').value;
            const credits = parseInt(document.getElementById('credits').value) || 0;
            const semester = document.getElementById('semester').value;
            const academicYear = document.getElementById('academicYear').value;

            if (!courseName || credits === 0) {
                showToast('Please enter course name and credits.', 'warning');
                return;
            }

            const grades = calculateGrades();

            const courseData = {
                courseName: courseName,
                credits: credits,
                semester: semester,
                academicYear: academicYear,
                finalPercentage: grades.finalPercentage,
                letterGrade: grades.letterGrade,
                assessments: []
            };

            // Collect assessment data
            for (let i = 1; i <= assessmentCount; i++) {
                const assessmentName = document.getElementById(`assessmentName${i}`).value;
                const fullMarks = parseFloat(document.getElementById(`fullMarks${i}`).value) || 0;
                const obtainedMark = parseFloat(document.getElementById(`obtainedMark${i}`).value) || 0;
                const weighting = parseFloat(document.getElementById(`weighting${i}`).value) || 0;

                if (assessmentName && fullMarks > 0) {
                    courseData.assessments.push({
                        name: assessmentName,
                        fullMarks: fullMarks,
                        obtainedMark: obtainedMark,
                        weighting: weighting
                    });
                }
            }

            // Try to save to file system
            let fileSaved = false;
            
            if (isFileSystemSupported()) {
                // Use File System Access API
                fileSaved = await saveCourseToFileSystem(courseData);
            } else {
                // Fallback: download file with suggested folder structure
                showToast('Your browser doesn\'t support folder creation. File will be downloaded.', 'warning', 4000);
                fileSaved = saveCourseAsDownload(courseData);
            }

            // Always save to localStorage for history tracking
            if (fileSaved) {
                saveCourseToDB(courseData);
                showToast('Course saved successfully!', 'success');
            }
        }

        // Function to reset the calculator state
        function resetCalculatorState() {
            // Confirm before deleting all data
            if (!confirm('⚠️ This will delete ALL saved course data permanently!\n\nAre you sure you want to continue?')) {
                return;
            }

            // 1. DELETE ALL SAVED DATA
            localStorage.removeItem(DB_NAME);
            initDatabase(); // Reinitialize empty database
            
            // 2. COURSE/MODULE DETAILS
            document.getElementById('courseName').value = '';
            document.getElementById('credits').value = '';
            document.getElementById('semester').value = '1';
            // Reset academic year to current
            const currentYear = new Date().getFullYear();
            const currentAcademicYear = `${currentYear}-${currentYear + 1}`;
            document.getElementById('academicYear').value = currentAcademicYear;
            document.getElementById('studyYearSelect').value = '1';

            // 3. ASSESSMENT COMPONENTS
            document.getElementById('assessmentsContainer').innerHTML = '';
            assessmentCount = 0;
            addAssessmentBlock(); // Add one empty block back

            // 4. COURSE RESULTS
            calculateGrades();

            // 5. UPDATE ALL DISPLAYS (now will show empty state)
            updateAllDisplays();
            
            showToast('All data has been deleted. Application reset complete.', 'success');
        }
        // Wait for the DOM to be fully loaded before running scripts
        document.addEventListener('DOMContentLoaded', function() {

        // Event listeners
        document.getElementById('addAssessment').addEventListener('click', addAssessmentBlock);
        document.getElementById('saveResults').addEventListener('click', saveResults);
        document.getElementById('exportData').addEventListener('click', exportToExcel);

        document.getElementById('importData').addEventListener('click', async function () {
            // If File System Access API is supported and we have a directory handle, use it
            if (isFileSystemSupported() && rootDirectoryHandle) {
                try {
                    await importFromFileSystem();
                } catch (error) {
                    console.error('File system import error:', error);
                    // Fallback to traditional file input
                    showFileInputDialog();
                }
            } else {
                // Traditional file input for unsupported browsers
                showFileInputDialog();
            }
        });

        // Helper function to show traditional file input dialog
        function showFileInputDialog() {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.xlsx, .xls';
            fileInput.onchange = function (e) {
                importFromExcel(e.target.files[0]);
            };
            fileInput.click();
        }

        // Clear Form button event listener
        document.getElementById('clearForm').addEventListener('click', function() {
            // Clear course details
            document.getElementById('courseName').value = '';
            document.getElementById('credits').value = '';
            document.getElementById('semester').value = '1';
            
            // Clear all assessments
            const assessmentsContainer = document.getElementById('assessmentsContainer');
            assessmentsContainer.innerHTML = '';
            
            // Clear COURSE RESULTS
            document.getElementById('finalPercentage').textContent = '0%';
            document.getElementById('finalLetter').textContent = '-';
            
            // Clear weight info
            const weightInfo = document.getElementById('weightInfo');
            if (weightInfo) {
                weightInfo.innerHTML = '';
            }
            
            // Clear target box
            const targetBox = document.getElementById('targetBox');
            if (targetBox) {
                targetBox.style.display = 'none';
            }
            
            // Clear OVERALL YEAR RESULTS
            document.getElementById('overallWAM').textContent = '0';
            document.getElementById('degreeClassification').textContent = '-';
            
            showToast('Form cleared. Ready for new course entry.', 'success');
        });

        // Reset button event listener
        document.getElementById('resetApp').addEventListener('click', resetCalculatorState);

        // Tab functionality
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function () {
                // Remove active class from all tabs and contents
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                // Add active class to clicked tab and corresponding content
                this.classList.add('active');
                const tabId = this.getAttribute('data-tab');
                document.getElementById(`${tabId}-content`).classList.add('active');

                // Update data for the selected tab
                updateCourseHistory();
            });
        });

        // Update displays when year selectors change
        document.getElementById('semester1Year').addEventListener('change', updateCourseHistory);
        document.getElementById('semester2Year').addEventListener('change', updateCourseHistory);
        document.getElementById('academicYearSelect').addEventListener('change', updateCourseHistory);
        document.getElementById('studyYearSelect').addEventListener('change', updateOverallYearResults);
        document.getElementById('academicYear').addEventListener('change', updateOverallYearResults);

        // Add event listeners to all assessment inputs for real-time calculation
        document.addEventListener('input', function (e) {
            if (e.target.id.includes('fullMarks') ||
                e.target.id.includes('obtainedMark') ||
                e.target.id.includes('weighting')) {
                calculateGrades();
            }
        });

        // Initialize with one assessment block
        addAssessmentBlock();

        // Fill year selects with current and past years
        populateYearSelects();

        // Initialize displays
        updateAllDisplays();

        // Force update on page load
        window.addEventListener('load', function () {
            updateOverallYearResults();
        });

        // ==================== PWA FUNCTIONALITY ====================

        // Service Worker registration
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('./sw.js')
                    .then(function (registration) {
                        console.log('ServiceWorker registered: ', registration);
                    })
                    .catch(function (registrationError) {
                        console.log('ServiceWorker registration failed: ', registrationError);
                    });
            });
        }

        // PWA Installation Prompt
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            console.log('PWA installation available');

            // Show install button (if you have one)
            // showInstallButton();
        });

        // For manual installation trigger
        function installPWA() {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted install');
                    }
                    deferredPrompt = null;
                });
            }
        }

        // --- START: FEEDBACK FUNCTIONALITY ---
        const feedbackFab = document.getElementById('feedbackFab');
        const feedbackPanel = document.getElementById('feedbackPanel');
        const feedbackClose = document.getElementById('feedbackClose');
        const feedbackOverlay = document.getElementById('feedbackOverlay');
        const feedbackSubmit = document.getElementById('feedbackSubmit');

        // Function to open the feedback panel
        function openFeedback() {
            feedbackPanel.classList.add('active');
            feedbackOverlay.classList.add('active');
        }

        // Function to close the feedback panel
        function closeFeedback() {
            feedbackPanel.classList.remove('active');
            feedbackOverlay.classList.remove('active');
        }

        // Add event listeners for feedback functionality
        feedbackFab.addEventListener('click', openFeedback);
        feedbackClose.addEventListener('click', closeFeedback);
        feedbackOverlay.addEventListener('click', closeFeedback);

        feedbackSubmit.addEventListener('click', function() {
            const easeOfUse = document.querySelector('input[name="ease"]:checked');
            const likes = document.getElementById('feedbackLikes').value.trim();
            const issues = document.getElementById('feedbackIssues').value.trim();
            const contact = document.getElementById('feedbackContact').value.trim();

            if (!issues) {
                showToast('Please describe your suggestion or issue before submitting.', 'warning');
                document.getElementById('feedbackIssues').focus();
                return;
            }

            // Telegram Bot Configuration
            const TELEGRAM_BOT_TOKEN = '8341555550:AAFHOgvgTA0EibWCRaKSfJUWfj3i6xZ2iBw';
            const TELEGRAM_CHAT_ID = '965490332';
            
            // Get device information
            const deviceInfo = {
                browser: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                screenSize: `${window.screen.width}x${window.screen.height}`,
                windowSize: `${window.innerWidth}x${window.innerHeight}`,
                online: navigator.onLine ? 'Online' : 'Offline'
            };
            
            // Detect device type
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const deviceType = isMobile ? '📱 Mobile' : '💻 Desktop';
            
            // Build feedback message
            const feedbackMessage = `🔔 New Feedback from HW GradeMetrix\n\n` +
                `📊 Ease of Use: ${easeOfUse ? easeOfUse.value.replace(/_/g, ' ').toUpperCase() : 'Not specified'}\n\n` +
                `👍 What they like:\n${likes || 'Not specified'}\n\n` +
                `💡 Suggestions/Issues:\n${issues}\n\n` +
                (contact ? `📞 Contact: ${contact}\n\n` : '') +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `📱 Device Info:\n` +
                `• Type: ${deviceType}\n` +
                `• Platform: ${deviceInfo.platform}\n` +
                `• Screen: ${deviceInfo.screenSize}\n` +
                `• Window: ${deviceInfo.windowSize}\n` +
                `• Language: ${deviceInfo.language}\n` +
                `• Status: ${deviceInfo.online}\n\n` +
                `🌐 Browser: ${deviceInfo.browser}\n\n` +
                `🕐 Time: ${new Date().toLocaleString()}`;
            
            // Send to Telegram
            const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(feedbackMessage)}`;
            
            fetch(telegramUrl, {
                method: 'GET',
                mode: 'no-cors'
            })
            .then(() => {
                showToast('Thank you! Your feedback has been sent successfully.', 'success');
                // Clear form
                document.getElementById('feedbackLikes').value = '';
                document.getElementById('feedbackIssues').value = '';
                document.getElementById('feedbackContact').value = '';
                const checkedRadio = document.querySelector('input[name="ease"]:checked');
                if (checkedRadio) checkedRadio.checked = false;
                closeFeedback();
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('Error sending feedback. Please try again.', 'error');
            });
        });
    
}); 