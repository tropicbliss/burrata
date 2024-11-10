import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Alarm, queryKey } from "./App"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"
import { MoreHorizontal } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { queryClient } from "./main"
import { parseTime, formatTime2, errorHandlingFetch } from "@/lib/utils"

function formatTime(hours: number, minutes: number) {
    const period = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours === 0 ? 12 : hours;
    const paddedMinutes = minutes.toString().padStart(2, '0');
    return `${hours}:${paddedMinutes} ${period}`;
}

function formatDays(days: number[]) {
    days.sort((a, b) => a - b)
    return days.map((day) => {
        switch (day) {
            case 1:
                return "Mon"
            case 2:
                return "Tue"
            case 3:
                return "Wed"
            case 4:
                return "Thu"
            case 5:
                return "Fri"
            case 6:
                return "Sat"
            default:
                return "Sun"
        }
    }).join(", ")
}

export const columns: ColumnDef<Alarm>[] = [
    {
        accessorKey: "time",
        header: "Time",
        cell: ({ row }) => {
            const { original } = row
            const formatted = formatTime(original.hours, original.minutes)

            return <div className="font-medium">{formatted}</div>
        },
    },
    {
        accessorKey: "days",
        header: "Day(s)",
        cell: ({ row }) => {
            const { original } = row
            const formatted = formatDays(original.days)

            return <div>{formatted}</div>
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const original = row.original
            const [time, setTime] = useState("")
            const [days, setDays] = useState<number[]>([])
            const [isUpdateDialogOpen, setUpdateDialogOpen] = useState(false)
            const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)

            const deleteAlarm = useMutation({
                mutationFn: async (id: number) => {
                    const previousAlarms = queryClient.getQueryData(queryKey)
                    queryClient.setQueryData(queryKey, (old: Alarm[]) => old.filter((alarm) => alarm.id !== id))
                    await errorHandlingFetch<void>(false, "/api/alarm", {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ id })
                    })
                    { previousAlarms }
                },
                onSuccess: () => {
                    toast.success("Alarm deleted successfully")
                },
                onError: (err, _, context?: { previousAlarms: Alarm[] }) => {
                    toast.error("Failed to delete alarm", {
                        description: err.message
                    })
                    if (context) {
                        queryClient.setQueryData(queryKey, context.previousAlarms)
                    }
                }
            })

            const updateAlarm = useMutation({
                mutationFn: async (data: Alarm) => {
                    const previousAlarms = queryClient.getQueryData(queryKey)
                    queryClient.setQueryData(queryKey, (old: Alarm[]) => old.map((alarm) => {
                        if (alarm.id === data.id) {
                            return data
                        } else {
                            return alarm
                        }
                    }))
                    await errorHandlingFetch<void>(false, "/api/alarm", {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(data)
                    })
                    { previousAlarms }
                },
                onSuccess: () => {
                    toast.success("Alarm updated successfully")
                },
                onError: (err, _, context?: { previousAlarms: Alarm[] }) => {
                    toast.error("Failed to update alarm", {
                        description: err.message
                    })
                    if (context) {
                        queryClient.setQueryData(queryKey, context.previousAlarms)
                    }
                }
            })

            return (
                <div className="text-right">
                    <Dialog open={isUpdateDialogOpen} onOpenChange={(open) => {
                        if (open) {
                            setTime(formatTime2(original.hours, original.minutes))
                            setDays(original.days)
                        }
                        setUpdateDialogOpen(open)
                    }}>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Edit alarm</DialogTitle>
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
                                    <Button onMouseDown={() => {
                                        const { hours, minutes } = parseTime(time)
                                        updateAlarm.mutate({
                                            days,
                                            hours,
                                            id: original.id,
                                            minutes,
                                            isEnabled: original.isEnabled
                                        })
                                    }}>Save changes</Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action will permanently delete your alarm and cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onMouseDown={() => deleteAlarm.mutate(original.id)}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <div className="space-x-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onMouseDown={() => setUpdateDialogOpen(true)}>Update alarm</DropdownMenuItem>
                                <DropdownMenuItem onMouseDown={() => setDeleteDialogOpen(true)}>Delete alarm</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Switch checked={original.isEnabled} onCheckedChange={(isChecked) => {
                            const { hours, minutes } = parseTime(time)
                            updateAlarm.mutate({
                                days,
                                hours,
                                id: original.id,
                                isEnabled: isChecked,
                                minutes
                            })
                        }} aria-label="Toggle alarm" />
                    </div>
                </div>
            )
        },
    },
]