import { ColumnDef } from "@tanstack/react-table"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alarm } from "./App"
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
import { Switch } from "@/components/ui/switch"

function formatTime(hours: number, minutes: number) {
    const period = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours === 0 ? 12 : hours;
    const paddedMinutes = minutes.toString().padStart(2, '0');
    return `${hours}:${paddedMinutes} ${period}`;
}

function formatTime2(hours: number, minutes: number) {
    const paddedHours = hours.toString().padStart(2, '0')
    const paddedMinutes = minutes.toString().padStart(2, '0');
    return `${paddedHours}:${paddedMinutes}`;
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
            const { hours, minutes, days, isEnabled } = original
            const formattedTime = formatTime2(hours, minutes)

            return (
                <div className="text-right">
                    <div className="space-x-3">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open dialog</span>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Edit alarm</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <div className="grid w-full max-w-sm items-center gap-1.5">
                                            <Label htmlFor="time">Time</Label>
                                            <Input type="time" id="time" value={formattedTime} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <div className="grid w-full max-w-sm items-center gap-1.5">
                                            <Label>Days</Label>
                                            <ToggleGroup type="multiple" variant="outline" value={days.map((day) => day.toString())}>
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
                                    <Button type="submit">Save changes</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Switch checked={isEnabled} aria-label="Toggle alarm" />
                    </div>
                </div>
            )
        },
    },
]