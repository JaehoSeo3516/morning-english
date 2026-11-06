// 문제 은행 공통 설정. 나머지 data/*.js 파일이 여기에 문제를 추가합니다.
//
// ★ 정답은 항상 첫 번째 보기에 적으세요. 화면에서는 자동으로 섞여 나옵니다.
// ★ 문제를 추가하면 저장 후 새로고침만 하면 자동으로 출제 순환에 들어갑니다.
//
// 각 파일의 한 줄 형식
//   listening*.js : [질문, 정답, 오답, 오답, 해설]
//   grammar*.js   : [빈칸 ___ 문장, 정답, 오답, 오답, 오답, 해설]
//   reading*.js   : addP("지문", [질문, 정답, 오답, 오답, 오답, 해설], [두 번째 질문 ...])
//   opic.js       : [그룹, 질문, 구조 팁]   그룹 a=묘사 b=습관·루틴 c=경험·비교 r=롤플레이
//   vocab*.js     : [단어, 품사, 뜻, 예문]   품사 n 명사 v 동사 adj 형용사 adv 부사 prep 전치사 conj 접속사 phr 표현
const TOEIC = { L: [], G: [], P: [] };
const OPIC = [];
const VOCA = [];
function addV(list) { list.forEach(([w, p, m, x]) => VOCA.push({ w, p, m, x })); }
function addP(text, ...qs) {
  TOEIC.P.push({ text, qs: qs.map(([q, a, b, c, d, e]) => ({ q, o: [a, b, c, d], e })) });
}
