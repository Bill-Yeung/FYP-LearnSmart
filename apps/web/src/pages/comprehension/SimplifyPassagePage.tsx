import { useToast } from "../../contexts"
import { SimplifyPassage } from "../../components/comprehension/SimplifyPassage"

export function SimplifyPassagePage() {
  const { showToast } = useToast()

  return (
    <div className="space-y-6">
      <SimplifyPassage onToast={showToast} />
    </div>
  )
}
