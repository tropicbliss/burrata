import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type AlarmFormProps = {
    time: string;
    days: number[];
    onTimeChange: (time: string) => void;
    onDaysChange: (days: number[]) => void
}

export const AlarmForm: React.FC<AlarmFormProps> = ({ time, days, onTimeChange, onDaysChange }) => {
    return (
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="time">Time</Label>
                    <Input type="time" id="time" value={time} onChange={(e) => onTimeChange(e.target.value)} />
                </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label>Days</Label>
                    <ToggleGroup type="multiple" variant="outline" value={days.map((day) => day.toString())} onValueChange={(days) => onDaysChange(days.map((day) => Number(day)))}>
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
    )
}