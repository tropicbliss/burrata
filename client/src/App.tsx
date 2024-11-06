import { ModeToggle } from "@/components/mode-toggle"
import { columns } from "./columns"
import { useEffect, useState } from "react"
import { DataTable } from "./data-table"

export type Alarm = {
  id: number;
  hours: number;
  minutes: number;
  days: number[];
  isEnabled: boolean;
}

async function getData(): Promise<Alarm[]> {
  // Fetch data from your API here.
  return [
    {
      id: 1,
      hours: 7,
      minutes: 0,
      days: [1, 4],
      isEnabled: true
    },
    {
      id: 2,
      hours: 8,
      minutes: 30,
      days: [1, 2, 3, 4, 5],
      isEnabled: false
    },
    {
      id: 3,
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
