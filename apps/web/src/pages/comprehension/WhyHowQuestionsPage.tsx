import { useToast } from "../../contexts"
import { WhyHowQuestionGenerator } from "../../components/comprehension/WhyHowQuestionGenerator"

export function WhyHowQuestionsPage() {
  const { showToast } = useToast()

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <WhyHowQuestionGenerator onToast={showToast} />
    </div>
  )
}
