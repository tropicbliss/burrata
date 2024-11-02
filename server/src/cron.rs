use anyhow::Result;
use nom::{
    bytes::complete::tag,
    character::complete::{char, digit1},
    combinator::{map_res, verify},
    multi::separated_list1,
    IResult,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CreateCronError {
    #[error("minutes < 60")]
    IncorrectMinute,
    #[error("hours < 24")]
    IncorrectHour,
    #[error("day < 7")]
    IncorrectDay,
}

pub fn create_cron(hours: u8, minutes: u8, days: Vec<u8>) -> Result<String> {
    if minutes >= 60 {
        return Err(CreateCronError::IncorrectMinute)?;
    }
    if hours >= 24 {
        return Err(CreateCronError::IncorrectHour)?;
    }
    if days.iter().any(|&day| day >= 7) {
        return Err(CreateCronError::IncorrectDay)?;
    }
    let day_segment = days
        .into_iter()
        .map(|day| (day + 1).to_string())
        .collect::<Vec<_>>()
        .join(",");
    Ok(format!("0 {minutes} {hours} ? * {day_segment}"))
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct ScheduleEntry {
    pub hours: u8,
    pub minutes: u8,
    pub days: Vec<u8>,
}

fn parse_cron_inner(input: &str) -> IResult<&str, ScheduleEntry> {
    let (input, _) = tag("0")(input)?;
    let (input, _) = char(' ')(input)?;
    let (input, minutes) = verify(map_res(digit1, str::parse::<u8>), |&num| num <= 59)(input)?;
    let (input, _) = char(' ')(input)?;
    let (input, hours) = verify(map_res(digit1, str::parse::<u8>), |&num| num <= 23)(input)?;
    let (input, _) = char(' ')(input)?;
    let (input, _) = char('?')(input)?;
    let (input, _) = char(' ')(input)?;
    let (input, _) = char('*')(input)?;
    let (input, _) = char(' ')(input)?;
    let (input, days) = separated_list1(char(','), |input| {
        verify(map_res(digit1, str::parse::<u8>), |&num| {
            num >= 1 && num <= 7
        })(input)
    })(input)
    .map(|(input, days)| (input, days.into_iter().map(|day| day - 1).collect()))?;
    Ok((
        input,
        ScheduleEntry {
            days,
            hours,
            minutes,
        },
    ))
}

pub fn parse_cron(value: &str) -> ScheduleEntry {
    parse_cron_inner(value).unwrap().1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_construct_parse_match() {
        let alarm = ScheduleEntry {
            minutes: 30,
            hours: 12,
            days: vec![1, 2, 3],
        };
        let cron = create_cron(alarm.hours, alarm.minutes, alarm.days.clone()).unwrap();
        let parsed_alarm = parse_cron(&cron);
        assert_eq!(alarm, parsed_alarm);
    }
}
