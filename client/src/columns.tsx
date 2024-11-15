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
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { parseTime, formatToMilitaryTime, errorHandlingFetch, formatAlarmSetToast } from "@/lib/utils"
import { AlarmForm } from "./AlarmForm"

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

function formatOneTimeAlarm(hours: number, minutes: number) {
    const currentMilitaryTime = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    })
    const alarmMilitaryTime = formatToMilitaryTime(hours, minutes)
    return alarmMilitaryTime > currentMilitaryTime ? "Today" : "Tomorrow"
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
            const formatted = original.days.length === 0 ? formatOneTimeAlarm(original.hours, original.minutes) : formatDays(original.days)

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
            const [isDropdownMenuOpen, setDropdownMenuOpen] = useState(false)

            const queryClient = useQueryClient()

            const deleteAlarm = useMutation({
                mutationFn: async (id: number) => {
                    queryClient.setQueryData(queryKey, (old: Alarm[]) => old.filter((alarm) => alarm.id !== id))
                    await errorHandlingFetch<void>(false, "/api/alarm", {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ id })
                    })
                },
                onSuccess: () => {
                    toast.success("Alarm deleted successfully")
                },
                onError: (err) => {
                    toast.error("Failed to delete alarm", {
                        description: err.message
                    })
                },
                onSettled: () => {
                    queryClient.invalidateQueries({ queryKey })
                }
            })

            const updateAlarm = useMutation({
                mutationFn: async (data: { alarm: Alarm, isDelete: boolean }) => {
                    let { alarm: updatedAlarm, isDelete } = data
                    if (!isDelete) {
                        updatedAlarm.isEnabled = true
                    }
                    queryClient.setQueryData(queryKey, (old: Alarm[]) => old.map((alarm) => {
                        if (alarm.id === data.alarm.id) {
                            return updatedAlarm
                        } else {
                            return alarm
                        }
                    }))
                    await errorHandlingFetch<void>(false, "/api/alarm", {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(updatedAlarm)
                    })
                    return { updatedAlarm }
                },
                onSuccess: (data) => {
                    if (data.updatedAlarm.isEnabled) {
                        const { updatedAlarm } = data
                        const formattedToast = formatAlarmSetToast(updatedAlarm.days, updatedAlarm.hours, updatedAlarm.minutes)
                        toast.success(formattedToast)
                    }
                },
                onError: (err) => {
                    toast.error("Failed to update alarm", {
                        description: err.message
                    })
                },
                onSettled: () => {
                    queryClient.invalidateQueries({ queryKey })
                }
            })

            return (
                <div className="text-right">
                    <Dialog open={isUpdateDialogOpen} onOpenChange={setUpdateDialogOpen} >
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Edit alarm</DialogTitle>
                            </DialogHeader>
                            <AlarmForm days={days} time={time} onDaysChange={setDays} onTimeChange={setTime} />
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button onMouseDown={() => {
                                        const { hours, minutes } = parseTime(time)
                                        updateAlarm.mutate({
                                            alarm: {
                                                days,
                                                hours,
                                                id: original.id,
                                                minutes,
                                                isEnabled: original.isEnabled,
                                            },
                                            isDelete: false
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
                        <DropdownMenu open={isDropdownMenuOpen} onOpenChange={setDropdownMenuOpen}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onMouseDown={() => {
                                    setDropdownMenuOpen(false)
                                    setUpdateDialogOpen(true)
                                    setTime(formatToMilitaryTime(original.hours, original.minutes))
                                    setDays(original.days)
                                }}>Update alarm</DropdownMenuItem>
                                <DropdownMenuItem onMouseDown={() => {
                                    setDropdownMenuOpen(false)
                                    setDeleteDialogOpen(true)
                                }}>Delete alarm</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Switch checked={original.isEnabled} onCheckedChange={(isChecked) => {
                            updateAlarm.mutate({
                                alarm: {
                                    ...original,
                                    isEnabled: isChecked,
                                },
                                isDelete: true
                            })
                        }} aria-label="Toggle alarm" />
                    </div>
                </div>
            )
        },
    },
]