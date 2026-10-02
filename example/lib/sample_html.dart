// SPDX-License-Identifier: GPL-2.0-or-later

const sampleHtml = '''
<h2>CKEditor 예제</h2>
<p>이 문서는 패키지에 포함된 로컬 에디터에서 편집됩니다.</p>
<p><strong>굵게</strong>, <i>기울임</i>, <u>밑줄</u>, <s>취소선</s>을 확인해 보세요.</p>
<p><span style="color:#e03131;">글자색</span>과 <span style="background-color:#fff3bf;">배경색</span>도 사용할 수 있습니다.</p>
<p>아래 첨자 H<sub>2</sub>O, 위 첨자 x<sup>2</sup></p>
<hr>
<p style="text-align:center;">가운데 정렬된 문단입니다.</p>
''';

final longSampleHtml = [
  '<h2>긴 문서 예제</h2>',
  for (var index = 1; index <= 24; index++)
    '<p>$index. 문서 아래쪽을 편집하면서 스크롤과 키보드가 커서를 가리지 않는지 '
        '확인해 보세요. <strong>굵게</strong>와 <i>기울임</i> 서식도 적용할 수 있습니다.</p>',
].join('\n');
