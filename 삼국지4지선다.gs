// Code.gs 파일

// 웹 앱 메인 함수
function doGet() {
  try {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('삼국지 4지선다 퀴즈')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    Logger.log(error);
    return HtmlService.createHtmlOutput(
      `<html><body><h2>오류가 발생했습니다</h2><p>${error.toString()}</p></body></html>`
    );
  }
}

// 클라이언트 측에서 호출할 함수: 퀴즈 데이터 가져오기
function getQuizData() {
  try {
    // 시트 ID와 시트 이름을 본인의 것으로 수정하세요
    const spreadsheetId = '1z46EvkDk-4yYSNPN-9J5Zi9OWoN-NfjBBKmF_XjSrbM';
    const sheetName = 'Question';

    // 스프레드시트와 시트 객체 가져오기
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('시트를 찾을 수 없습니다.');
    }

    // 데이터 범위 가져오기 (헤더 제외)
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    // 데이터가 없을 경우 처리
    if (values.length <= 1) { // 헤더 행만 있는 경우
      throw new Error('시트에 데이터가 없습니다.');
    }

    // 헤더 추출
    const headers = values[0];

    // 헤더에 필요한 필드가 모두 있는지 확인
    const requiredHeaders = ['question', 'option1', 'option2', 'option3', 'option4', 'correct', 'explanation'];
    const missingHeaders = requiredHeaders.filter(header => headers.indexOf(header) === -1);
    if (missingHeaders.length > 0) {
      throw new Error(`필수 헤더가 없습니다: ${missingHeaders.join(', ')}`);
    }

    // 데이터를 JSON 객체로 변환
    const quizData = [];
    for (let i = 1; i < values.length; i++) { // 헤더 행 제외
      const row = values[i];
      const questionData = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        questionData[header] = row[j];
      }
      
      // 'correct' 값이 숫자로 변환 가능한지 확인하고,
      // 유효한 범위(0~3) 내에 있는지 확인.  문자열 "0", "1" 등도 허용.
      let correctOption = Number(questionData.correct);
      if (isNaN(correctOption) || correctOption < 0 || correctOption > 3) {
        throw new Error(`행 ${i+1}의 'correct' 값(${questionData.correct})은 0, 1, 2, 3 중 하나여야 합니다.`);
      }
      
      questionData.correct = correctOption; // 명시적으로 숫자로 저장
      quizData.push(questionData);
    }

    return quizData;
  } catch (error) {
    Logger.log('getQuizData 오류: ' + error);
    throw error; // 클라이언트에 오류 전달
  }
}

// 클라이언트 측에서 호출할 함수: 퀴즈 결과 저장
function saveQuizResult(score, totalQuestions) {
  try {
    // 결과를 저장할 스프레드시트 ID와 시트 이름
    const spreadsheetId = '1z46EvkDk-4yYSNPN-9J5Zi9OWoN-NfjBBKmF_XjSrbM';
    const resultsSheetName = 'Result';
    
    // 스프레드시트와 시트 객체 가져오기
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    let sheet = spreadsheet.getSheetByName(resultsSheetName);
    
    // 결과 시트가 없으면 새로 생성
    if (!sheet) {
      sheet = spreadsheet.insertSheet(resultsSheetName);
      // 헤더 추가
      sheet.appendRow(['타임스탬프', '점수', '총 문항', '백분율']);
    }
    
    // 백분율 계산
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    
    // 타임스탬프 생성
    const timestamp = new Date().toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'});
    
    // 데이터 행 추가
    sheet.appendRow([timestamp, score, totalQuestions, percentage + '%']);
    
    return {
      status: 'success',
      message: '결과가 성공적으로 저장되었습니다.'
    };
  } catch (error) {
    Logger.log('saveQuizResult 오류: ' + error);
    throw error; // 클라이언트에 오류 전달
  }
}
