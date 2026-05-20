import { useToast } from "../../contexts"
import { GuidedBrainstorm } from "../../components/comprehension/GuidedBrainstorm"

export function GuidedBrainstormPage() {
  const { showToast } = useToast()

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GuidedBrainstorm onToast={showToast} />
    </div>
  )
}
