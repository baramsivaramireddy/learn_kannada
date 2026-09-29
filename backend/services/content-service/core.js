function createHttpError(status, message) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function evaluateQuiz(quiz, answers) {
	if (!Array.isArray(answers)) {
		throw createHttpError(400, "answers must be an array");
	}

	const itemsById = new Map(quiz.items.map((item) => [item.id, item]));
	const answersByItemId = new Map();

	for (const answer of answers) {
		if (!answer || typeof answer.quizItemId !== "string" || !Array.isArray(answer.selectedOptionIds)) {
			throw createHttpError(400, "Each answer needs quizItemId and selectedOptionIds");
		}
		if (!itemsById.has(answer.quizItemId)) {
			throw createHttpError(400, "An answer references an unavailable quiz item");
		}
		if (answersByItemId.has(answer.quizItemId)) {
			throw createHttpError(400, "Each quiz item can only be answered once");
		}
		if (answer.selectedOptionIds.some((id) => typeof id !== "string") || new Set(answer.selectedOptionIds).size !== answer.selectedOptionIds.length) {
			throw createHttpError(400, "Selected option IDs must be unique strings");
		}

		const optionIds = new Set(itemsById.get(answer.quizItemId).options.map((option) => option.id));
		if (answer.selectedOptionIds.some((id) => !optionIds.has(id))) {
			throw createHttpError(400, "An answer references an unavailable option");
		}
		answersByItemId.set(answer.quizItemId, answer.selectedOptionIds);
	}

	const itemResults = quiz.items.map((item) => {
		const correctOptionIds = item.options.filter((option) => option.isCorrect).map((option) => option.id);
		const selectedOptionIds = answersByItemId.get(item.id) || [];
		const correct = selectedOptionIds.length === correctOptionIds.length
			&& selectedOptionIds.every((id) => correctOptionIds.includes(id));

		return { quizItemId: item.id, correct, correctOptionIds };
	});
	const totalItems = quiz.items.length;
	const correctItems = itemResults.filter((result) => result.correct).length;
	const percentage = totalItems ? Math.round((correctItems / totalItems) * 10000) / 100 : 0;

	return {
		quizId: quiz.id,
		totalItems,
		correctItems,
		percentage,
		passingPercentage: quiz.passingPercentage,
		passed: percentage >= quiz.passingPercentage,
		itemResults,
	};
}

module.exports = { createHttpError, evaluateQuiz };
