// Web app main function
function doGet() {
  try {
    // Ensure this file name matches your HTML file name
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Internal Control Quiz')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    Logger.log('doGet error: ' + error.toString());
    // Return a basic error page if doGet fails
    return HtmlService.createHtmlOutput(
      `<html><body><h2>Error occurred</h2><p>${error.toString()}</p></body></html>`
    );
  }
}

// Function to be called from client: Get quiz data
function getQuizData() {
  Logger.log('Attempting to get quiz data...');
  try {
    // Modify spreadsheet ID to match your spreadsheet
    // !! IMPORTANT: Double-check this ID !!
    const spreadsheetId = '1z46EvkDk-4yYSNPN-9J5Zi9OWoN-NfjBBKmF_XjSrbM';
    // !! IMPORTANT: Double-check this sheet name !!
    const sheetName = 'Question';

    Logger.log(`Opening spreadsheet with ID: ${spreadsheetId}`);
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    Logger.log('Spreadsheet opened successfully.');

    Logger.log(`Getting sheet by name: ${sheetName}`);
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log(`Error: Sheet '${sheetName}' not found.`);
      throw new Error(`Sheet '${sheetName}' not found.`);
    }
    Logger.log(`Sheet '${sheetName}' found.`);

    Logger.log('Getting data range...');
    const dataRange = sheet.getDataRange();
    Logger.log('Data range obtained.');

    Logger.log('Getting values from data range...');
    const values = dataRange.getValues();
    Logger.log(`Obtained ${values.length} rows of data.`);

    // Handle case with no data (only header row exists)
    if (values.length <= 1) {
      Logger.log('Error: No data found in sheet (only header row).');
      throw new Error('No data found in sheet.');
    }

    // Extract headers
    const headers = values[0];
    Logger.log('Headers extracted: ' + headers.join(', '));

    // Check if all required fields exist
    const requiredHeaders = ['question_id', 'language', 'question', 'option1', 'option2', 'option3', 'option4', 'correct', 'explanation'];
    const missingHeaders = requiredHeaders.filter(header => headers.indexOf(header) === -1);
    if (missingHeaders.length > 0) {
      Logger.log(`Error: Missing required headers: ${missingHeaders.join(', ')}`);
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }
    Logger.log('All required headers found.');

    // Convert data to JSON objects
    const quizData = [];
    for (let i = 1; i < values.length; i++) { // Skip header row
      const row = values[i];
      // Skip empty rows more robustly
      if (row.every(cell => cell === '' || cell === null)) {
         Logger.log(`Skipping empty row ${i + 1}`);
         continue;
      }

      const questionData = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        questionData[header] = row[j];
      }

      // Basic check for essential fields before processing
      if (!questionData.question_id || !questionData.question || questionData.correct === undefined || questionData.correct === null) {
          Logger.log(`Skipping row ${i+1} due to missing essential data: ${JSON.stringify(questionData)}`);
          continue;
      }

      // Verify 'correct' value is convertible to number and within valid range (0-3)
      let correctOption;
      // Try parsing as number, handle potential errors
      try {
          correctOption = Number(questionData.correct);
          if (isNaN(correctOption) || correctOption < 0 || correctOption > 3 || !Number.isInteger(correctOption)) {
              Logger.log(`Error: Row ${i+1}'s 'correct' value (${questionData.correct}) is invalid. Must be an integer 0, 1, 2, or 3.`);
              throw new Error(`Row ${i+1}'s 'correct' value (${questionData.correct}) is invalid. Must be an integer 0, 1, 2, or 3.`);
          }
      } catch (e) {
           Logger.log(`Error processing 'correct' value in row ${i+1}: ${e.message}`);
           throw new Error(`Error processing 'correct' value in row ${i+1}: ${e.message}`);
      }


      // Verify language value is one of the supported languages
      const supportedLanguages = ['en', 'zh', 'ko'];
      if (!supportedLanguages.includes(questionData.language)) {
        Logger.log(`Warning: Row ${i+1} has unsupported language: '${questionData.language}'. Supported: ${supportedLanguages.join(', ')}.`);
        // We'll still include it, just log a warning
      }

      questionData.correct = correctOption; // Explicitly store as number
      quizData.push(questionData);
    }

    Logger.log(`Successfully processed ${quizData.length} questions.`);
    return quizData;

  } catch (error) {
    Logger.log('getQuizData error: ' + error.toString());
    // Pass the error message back to the client
    throw new Error('Server error fetching quiz data: ' + error.message);
  }
}

// Function to be called from client: Save quiz results
function saveQuizResult(name, employeeId, company, score, totalQuestions, userAnswers, language) {
  Logger.log('Attempting to save quiz results...');
  try {
    // Spreadsheet ID and sheet names for saving results
    // !! IMPORTANT: Double-check this ID !!
    const spreadsheetId = '1z46EvkDk-4yYSNPN-9J5Zi9OWoN-NfjBBKmF_XjSrbM';
    // !! IMPORTANT: Double-check these sheet names !!
    const resultsSheetName = 'Result';
    const detailsSheetName = 'AnswerDetails';

    Logger.log(`Opening spreadsheet for saving results with ID: ${spreadsheetId}`);
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    Logger.log('Spreadsheet opened successfully for saving.');

    // Check or create main results sheet
    Logger.log(`Checking for sheet: ${resultsSheetName}`);
    let resultSheet = spreadsheet.getSheetByName(resultsSheetName);
    if (!resultSheet) {
      Logger.log(`Sheet '${resultsSheetName}' not found, creating it.`);
      resultSheet = spreadsheet.insertSheet(resultsSheetName);
      // Add headers
      resultSheet.appendRow(['Timestamp', 'Name', 'Employee ID', 'Company', 'Score', 'Total Questions', 'Percentage', 'Language']);
      Logger.log(`Sheet '${resultsSheetName}' created with headers.`);
    } else {
       Logger.log(`Sheet '${resultsSheetName}' found.`);
    }

    // Check or create detailed results sheet
    Logger.log(`Checking for sheet: ${detailsSheetName}`);
    let detailsSheet = spreadsheet.getSheetByName(detailsSheetName);
    if (!detailsSheet) {
      Logger.log(`Sheet '${detailsSheetName}' not found, creating it.`);
      detailsSheet = spreadsheet.insertSheet(detailsSheetName);
      // Add headers
      detailsSheet.appendRow(['Timestamp', 'Name', 'Employee ID', 'Company', 'Question ID', 'Question Number', 'User Answer', 'Correct Answer', 'Is Correct', 'Language']);
       Logger.log(`Sheet '${detailsSheetName}' created with headers.`);
    } else {
       Logger.log(`Sheet '${detailsSheetName}' found.`);
    }

    // Create timestamp
    const timestamp = new Date().toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'});
    Logger.log(`Generated timestamp: ${timestamp}`);

    // Calculate percentage
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    Logger.log(`Calculated percentage: ${percentage}%`);

    // Add row to main results sheet
    Logger.log('Appending row to main results sheet...');
    resultSheet.appendRow([timestamp, name, employeeId, company, score, totalQuestions, percentage + '%', language]);
    Logger.log('Row appended to main results sheet.');

    // Add detailed answer information to details sheet
    Logger.log('Appending rows to detailed results sheet...');
    userAnswers.forEach((answer, index) => {
      // Ensure answer is not null (skipped questions will be null)
      if (answer !== null) {
        // Get question ID if available, default to N/A if not found (though it should be)
        const questionId = answer.questionId || 'N/A';

        detailsSheet.appendRow([
          timestamp,
          name,
          employeeId,
          company,
          questionId,           // Question ID from database
          answer.questionNumber,  // Question number in the quiz
          answer.userAnswer,      // User answer (0-3)
          answer.correctAnswer,   // Correct answer (0-3)
          answer.isCorrect ? 'O' : 'X',  // Is correct
          language                // Language used
        ]);
         Logger.log(`Appended detail for question ${index + 1}: ${JSON.stringify(answer)}`);
      } else {
         Logger.log(`Skipping detail for question ${index + 1} (no answer recorded).`);
      }
    });
    Logger.log('Finished appending rows to detailed results sheet.');

    Logger.log('Quiz results saved successfully.');
    return {
      status: 'success',
      message: 'Results saved successfully.'
    };

  } catch (error) {
    Logger.log('saveQuizResult error: ' + error.toString());
    // Pass the error message back to the client
    throw new Error('Server error saving results: ' + error.message);
  }
}
