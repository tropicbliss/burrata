import { ModeToggle } from "@/components/mode-toggle"
import { columns } from "./columns"
import { DataTable } from "./data-table"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlarmClockOff, AlarmClockPlus, AlertCircle, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useState } from "react"
import { toast } from "sonner"
import { queryClient } from "./main"
import { formatTime2, parseTime } from "@/lib/utils"

export type Alarm = {
  id: number;
  hours: number;
  minutes: number;
  days: number[];
  isEnabled: boolean;
}

async function getData(): Promise<Alarm[]> {
  const response = await fetch("/api/alarm")
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    if (json.error) {
      throw new Error(json.error)
    }
  }
  if (json === null) {
    throw new Error()
  }
  return json
}

export const queryKey = ["alarm"]

type AlarmWithoutId = Omit<Alarm, "id">

function getNextHour() {
  const now = new Date()
  const currentHour = now.getHours()
  if (currentHour === 23) {
    return 0
  }
  return currentHour + 1
}

function App() {
  const { data, error } = useQuery({
    queryKey,
    queryFn: getData,
    staleTime: Infinity,
    throwOnError(error) {
      console.error(error)
      return false
    },
  })

  const [time, setTime] = useState("")
  const [days, setDays] = useState<number[]>([])

  const addAlarm = useMutation({
    mutationFn: async (data: AlarmWithoutId) => {
      const response = await fetch("/api/alarm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      })
      const json = await response.json().catch(() => null)
      if (!response.ok) {
        if (json.error) {
          throw new Error(json.error)
        }
      }
      if (json === null) {
        throw new Error()
      }
      return { ...data, id: json.id as number }
    },
    onSuccess: (newAlarm: Alarm) => {
      queryClient.setQueryData(queryKey, (oldAlarms: Alarm[]) => [...oldAlarms, newAlarm])
      toast.success("Alarm added successfully")
    },
    onError: (err) => {
      toast.error("Failed to add alarm", {
        description: err.message
      })
    }
  })

  const [isAddAlarmOpen, setAddAlarmOpen] = useState(false)

  async function cancelAlarm() {
    await fetch("/api/stop")
  }

  return (
    <div className="space-y-4">
      <div className="border-b">
        <div className="flex h-16 justify-between items-center px-4">
          <div className="scroll-m-20 text-2xl font-semibold tracking-tight select-none">Alarm</div>
          <div className="space-x-3">
            <Dialog open={isAddAlarmOpen} onOpenChange={(open) => {
              if (open) {
                setTime(formatTime2(getNextHour(), 0))
                setDays([])
              }
              setAddAlarmOpen(open)
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <AlarmClockPlus />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add alarm</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                      <Label htmlFor="time">Time</Label>
                      <Input type="time" id="time" value={time} onChange={(e) => setTime(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                      <Label>Days</Label>
                      <ToggleGroup type="multiple" variant="outline" value={days.map((day) => day.toString())} onValueChange={(days) => setDays(days.map((day) => Number(day)))}>
                        <ToggleGroupItem value="1">M</ToggleGroupItem>
                        <ToggleGroupItem value="2">T</ToggleGroupItem>
                        <ToggleGroupItem value="3">W</ToggleGroupItem>
                        <ToggleGroupItem value="4">T</ToggleGroupItem>
                        <ToggleGroupItem value="5">F</ToggleGroupItem>
                        <ToggleGroupItem value="6">S</ToggleGroupItem>
                        <ToggleGroupItem value="7">S</ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button onClick={() => {
                      const { hours, minutes } = parseTime(time)
                      addAlarm.mutate({
                        days,
                        hours,
                        isEnabled: true,
                        minutes
                      })
                    }}>Save changes</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="icon" onClick={cancelAlarm}>
              <AlarmClockOff />
            </Button>
            <ModeToggle />
          </div>
        </div>
      </div>
      <div className="mx-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Error fetching alarm data. Please try again.
            </AlertDescription>
          </Alert>
        )}
        {data && <>
          {data.length === 0 ? (
            <Alert>
              <SearchX className="h-4 w-4" />
              <AlertTitle>No alarms found!</AlertTitle>
              <AlertDescription className="underline cursor-pointer" onClick={() => setAddAlarmOpen(true)}>
                Add your first alarm.
              </AlertDescription>
            </Alert>
          ) : <DataTable columns={columns} data={data} />}
        </>}
      </div>
    </div>
  )
}

export default App
