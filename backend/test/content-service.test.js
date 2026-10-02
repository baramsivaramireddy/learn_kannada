const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateQuizItems } = require('../services/content-service/core');

function quizItems(type, correctIds) {
  return [{
    id: 'item-1',
    type,
    options: [
      { id: 'option-a', isCorrect: correctIds.includes('option-a') },
      { id: 'option-b', isCorrect: correctIds.includes('option-b') },
      { id: 'option-c', isCorrect: correctIds.includes('option-c') },
    ],
  }];
}

test('SCQ and sound items score their one correct option', () => {
  for (const type of ['SCQ', 'SOUND']) {
    const result = evaluateQuizItems('subsection-1', quizItems(type, ['option-b']), [
      { quizItemId: 'item-1', selectedOptionIds: ['option-b'] },
    ]);
    assert.equal(result.correctItems, 1);
    assert.equal(result.percentage, 100);
    assert.equal(result.subsectionId, 'subsection-1');
    assert.equal('passed' in result, false);
    assert.equal('passingPercentage' in result, false);
  }
});

test('MCQ compares the complete selected set regardless of order', () => {
  const items = quizItems('MCQ', ['option-a', 'option-c']);
  const exact = evaluateQuizItems('subsection-1', items, [{ quizItemId: 'item-1', selectedOptionIds: ['option-c', 'option-a'] }]);
  const partial = evaluateQuizItems('subsection-1', items, [{ quizItemId: 'item-1', selectedOptionIds: ['option-a'] }]);
  const extra = evaluateQuizItems('subsection-1', items, [{ quizItemId: 'item-1', selectedOptionIds: ['option-a', 'option-b', 'option-c'] }]);

  assert.equal(exact.correctItems, 1);
  assert.equal(partial.correctItems, 0);
  assert.equal(extra.correctItems, 0);
});

test('omitted answers are incorrect and count toward the denominator', () => {
  const result = evaluateQuizItems('subsection-1', quizItems('SCQ', ['option-a']), []);

  assert.equal(result.totalItems, 1);
  assert.equal(result.correctItems, 0);
  assert.equal(result.percentage, 0);
});

test('submissions cannot answer an unavailable item or option', () => {
  const items = quizItems('SCQ', ['option-a']);

  assert.throws(() => evaluateQuizItems('subsection-1', items, [{ quizItemId: 'other', selectedOptionIds: ['option-a'] }]), { status: 400 });
  assert.throws(() => evaluateQuizItems('subsection-1', items, [{ quizItemId: 'item-1', selectedOptionIds: ['other'] }]), { status: 400 });
});