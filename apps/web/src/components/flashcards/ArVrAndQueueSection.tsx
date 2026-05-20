import { Button } from "../ui/Button"
import { Card } from "../ui/Card"

type ArVrActions = typeof import("../../configs/flashcardsData").arVrActions

type Props = {
  actions: ArVrActions
  onToast: (msg: string) => void
}

export function ArVrAndQueueSection({ actions, onToast }: Props) {

  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2">
      {actions.map(action => (
        <Card key={action.title} title={action.title} subtitle={action.desc}>
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600 dark:text-gray-400">{action.note}</div>
            <Button onClick={() => onToast(`${action.cta} (UI only)`)}>{action.cta}</Button>
          </div>
        </Card>
      ))}
      
    </section>
  )
}
