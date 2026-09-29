const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateQuiz } = require('../services/content-service/core');

function quizWith(type, correctIds) {
  return {
    id: 'quiz-1',
    passingPercentage: 70,
    items: [{
      id: 'item-1',
      type,
      options: [
        { id: 'option-a', isCorrect: correctIds.includes('option-a') },
        { id: 'option-b', isCorrect: correctIds.includes('option-b') },
        { id: 'option-c', isCorrect: correctIds.includes('option-c') },
      ],
    }],
  };
}

test('SCQ and sound items score their one correct option', () => {
  for (const type of ['SCQ', 'SOUND']) {
    const result = evaluateQuiz(quizWith(type, ['option-b']), [
      { quizItemId: 'item-1', selectedOptionIds: ['option-b'] },
    ]);
    assert.equal(result.correctItems, 1);
    assert.equal(result.passed, true);
  }
});

test('MCQ compares the complete selected set regardless of order', () => {
  const quiz = quizWith('MCQ', ['option-a', 'option-c']);
  const exact = evaluateQuiz(quiz, [{ quizItemId: 'item-1', selectedOptionIds: ['option-c', 'option-a'] }]);
  const partial = evaluateQuiz(quiz, [{ quizItemId: 'item-1', selectedOptionIds: ['option-a'] }]);
  const extra = evaluateQuiz(quiz, [{ quizItemId: 'item-1', selectedOptionIds: ['option-a', 'option-b', 'option-c'] }]);

  assert.equal(exact.correctItems, 1);
  assert.equal(partial.correctItems, 0);
  assert.equal(extra.correctItems, 0);
});

test('omitted answers are incorrect and count toward the denominator', () => {
  const quiz = quizWith('SCQ', ['option-a']);
  const result = evaluateQuiz(quiz, []);

  assert.equal(result.totalItems, 1);
  assert.equal(result.correctItems, 0);
  assert.equal(result.percentage, 0);
});

test('submissions cannot answer an unavailable item or option', () => {
  const quiz = quizWith('SCQ', ['option-a']);

  assert.throws(() => evaluateQuiz(quiz, [{ quizItemId: 'other', selectedOptionIds: ['option-a'] }]), { status: 400 });
  assert.throws(() => evaluateQuiz(quiz, [{ quizItemId: 'item-1', selectedOptionIds: ['other'] }]), { status: 400 });
});