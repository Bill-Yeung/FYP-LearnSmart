from app.services.game.studyData_service import StudyDataService


class DummyQuestion:
    def __init__(self, question_id: str, mastery_reward: int):
        self.questionId = question_id
        self.masteryReward = mastery_reward


class DummyScript:
    def __init__(self, mastery_reward_base: int, hint_penalty: int):
        self.masteryRewardBase = mastery_reward_base
        self.hintPenalty = hint_penalty


def test_calculate_mastery_earned_returns_zero_for_incorrect_answers():
    question = DummyQuestion(question_id="q1", mastery_reward=50)
    script = DummyScript(mastery_reward_base=20, hint_penalty=5)

    earned = StudyDataService.calculate_mastery_earned(
        question=question,
        is_correct=False,
        hints_used=0,
        attempt_number=1,
        script=script,
    )

    assert earned == 0


def test_calculate_mastery_earned_returns_zero_when_show_answer_used():
    question = DummyQuestion(question_id="q2", mastery_reward=50)
    script = DummyScript(mastery_reward_base=20, hint_penalty=5)

    earned = StudyDataService.calculate_mastery_earned(
        question=question,
        is_correct=True,
        hints_used=999,
        attempt_number=1,
        script=script,
    )

    assert earned == 0


def test_calculate_mastery_earned_applies_hint_and_attempt_penalties():
    question = DummyQuestion(question_id="q3", mastery_reward=100)
    script = DummyScript(mastery_reward_base=20, hint_penalty=10)

    earned = StudyDataService.calculate_mastery_earned(
        question=question,
        is_correct=True,
        hints_used=2,
        attempt_number=3,
        script=script,
    )

    # base reward 100, minus 2 hints * 10, minus 2 extra attempts * 20 = 40
    assert earned == 40


def test_calculate_mastery_earned_never_goes_negative():
    question = DummyQuestion(question_id="q4", mastery_reward=25)
    script = DummyScript(mastery_reward_base=20, hint_penalty=15)

    earned = StudyDataService.calculate_mastery_earned(
        question=question,
        is_correct=True,
        hints_used=2,
        attempt_number=3,
        script=script,
    )

    assert earned == 0
