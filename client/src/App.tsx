import { ModeToggle } from "@/components/mode-toggle"
import { columns } from "./columns"
import { useEffect, useState } from "react"
import { DataTable } from "./data-table"
import { z } from "zod"

const schema = z.object({
  hours: z.number().min(0).max(23),
  minutes: z.number().min(0).max(59),
  days: z.array(z.number().min(0).max(6)),
  isEnabled: z.boolean()
})

export type Alarm = z.infer<typeof schema>

async function getData(): Promise<Alarm[]> {
  // Fetch data from your API here.
  return [
    {
      hours: 7,
      minutes: 0,
      days: [1, 4],
      isEnabled: true
    },
    {
      hours: 8,
      minutes: 30,
      days: [1, 2, 3, 4, 5],
      isEnabled: false
    },
    {
      hours: 9,
      minutes: 0,
      days: [6, 7],
      isEnabled: false
    },
    // ...
  ]
}

function App() {
  const [alarms, setAlarms] = useState<Alarm[] | null>()

  useEffect(() => {
    getData().then((data) => setAlarms(data))
  }, [])

  return (
    <>
      <div className="border-b">
        <div className="flex h-16 justify-between items-center px-4">
          <div className="scroll-m-20 text-2xl font-semibold tracking-tight select-none">Alarm</div>
          <ModeToggle />
        </div>
      </div>
      <div className="p-4">
        {alarms && <DataTable columns={columns} data={alarms} />}
      </div>
    </>
  )
}

export default App
