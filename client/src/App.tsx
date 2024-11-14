import { ModeToggle } from "@/components/mode-toggle"
import { columns } from "./columns"
import { DataTable } from "./data-table"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlarmClockOff, AlarmClockPlus, AlertCircle, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { errorHandlingFetch, formatAlarmSetToast, formatToMilitaryTime, parseTime } from "@/lib/utils"

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
  const queryClient = useQueryClient()
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

  const [isAddAlarmOpen, setAddAlarmOpen] = useState(false)

  const addAlarm = useMutation({
    mutationFn: async (data: AlarmWithoutId) => {
      const previousAlarms = queryClient.getQueryData(queryKey)
      const response = await errorHandlingFetch<{ id: number }>(true, "/api/alarm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      })
      setAddAlarmOpen(false)
      return {
        newAlarm: { ...data, id: response.id },
        previousAlarms
      }
    },
    onSuccess: ({ newAlarm }: { newAlarm: Alarm }) => {
      queryClient.setQueryData(queryKey, (oldAlarms: Alarm[]) => [...oldAlarms, newAlarm])
      const formattedToast = formatAlarmSetToast(newAlarm.days, newAlarm.hours, newAlarm.minutes)
      toast.success(formattedToast)
    },
    onError: (err, _, context?: { previousAlarms: Alarm[] }) => {
      if (context) {
        queryClient.setQueryData(queryKey, context.previousAlarms)
      }
      toast.error("Failed to add alarm", {
        description: err.message
      })
    }
  })

  const stopAlarm = useMutation({
    mutationFn: async () => {
      await errorHandlingFetch<void>(false, "/api/stop")
    },
    onSuccess: () => {
      toast.success("Successfully stopped alarm")
    },
    onError: (err) => {
      toast.error("Failed to stop alarm", {
        description: err.message
      })
    }
  })

  useEffect(() => {
    if (isAddAlarmOpen) {
      setTime(formatToMilitaryTime(getNextHour(), 0))
      setDays([])
    }
  }, [isAddAlarmOpen])

  return (
    <div className="space-y-4">
      <div className="border-b">
        <div className="flex h-16 justify-between items-center px-4">
          <div className="scroll-m-20 text-2xl font-semibold tracking-tight select-none">Alarm</div>
          <div className="space-x-3">
            <Dialog open={isAddAlarmOpen} onOpenChange={setAddAlarmOpen}>
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
                        <ToggleGroupItem value="0">S</ToggleGroupItem>
                        <ToggleGroupItem value="1">M</ToggleGroupItem>
                        <ToggleGroupItem value="2">T</ToggleGroupItem>
                        <ToggleGroupItem value="3">W</ToggleGroupItem>
                        <ToggleGroupItem value="4">T</ToggleGroupItem>
                        <ToggleGroupItem value="5">F</ToggleGroupItem>
                        <ToggleGroupItem value="6">S</ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onMouseDown={() => {
                    const { hours, minutes } = parseTime(time)
                    addAlarm.mutate({
                      days,
                      hours,
                      isEnabled: true,
                      minutes
                    })
                  }}>Save changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="icon" onMouseDown={() => stopAlarm.mutate()}>
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
              <AlertDescription className="underline cursor-pointer" onMouseDown={() => setAddAlarmOpen(true)}>
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
