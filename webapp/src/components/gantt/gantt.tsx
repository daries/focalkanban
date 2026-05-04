// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useMemo} from 'react'
import moment from 'moment'

import {Board, IPropertyTemplate} from '../../blocks/board'
import {BoardView} from '../../blocks/boardView'
import {Card} from '../../blocks/card'
import propsRegistry from '../../properties'

import './gantt.scss'

const GANTT_COLORS = [
    '#4F46E5', // Indigo
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#3B82F6', // Blue
    '#EC4899', // Pink
    '#06B6D4', // Cyan
]

function getCardColor(card: Card, board: Board): string {
    const statusProp = board.cardProperties.find((p) => p.name.toLowerCase() === 'status' || p.type === 'select')
    if (statusProp && card.fields.properties[statusProp.id]) {
        const propValue = card.fields.properties[statusProp.id] as string
        const option = statusProp.options.find((o) => o.id === propValue)
        if (option) {
            // Map Focalboard colors to hex
            const colorMap: Record<string, string> = {
                propColorDefault: '#5d5fef',
                propColorGray: '#95a5a6',
                propColorBrown: '#795548',
                propColorOrange: '#ff9800',
                propColorYellow: '#ffeb3b',
                propColorGreen: '#4caf50',
                propColorBlue: '#2196f3',
                propColorPurple: '#9c27b0',
                propColorPink: '#e91e63',
                propColorRed: '#f44336',
            }
            return colorMap[option.color] || '#5d5fef'
        }
    }

    // Default: use hash of card id to pick a consistent color
    let hash = 0
    for (let i = 0; i < card.id.length; i++) {
        hash = card.id.charCodeAt(i) + ((hash << 5) - hash)
    }
    return GANTT_COLORS[Math.abs(hash) % GANTT_COLORS.length]
}

type Props = {
    board: Board
    cards: Card[]
    activeView: BoardView
    readonly: boolean
    dateDisplayProperty?: IPropertyTemplate
    showCard: (cardId?: string) => void
    addCard: (properties: Record<string, string>) => void
}

const Gantt = (props: Props) => {
    const {cards, dateDisplayProperty, showCard} = props

    const timelineData = useMemo(() => {
        const startProp = props.board.cardProperties.find((p) => p.name.toLowerCase().includes('start') || p.name.toLowerCase().includes('mulai'))
        const endProp = props.board.cardProperties.find((p) => p.name.toLowerCase().includes('end') || p.name.toLowerCase().includes('selesai') || p.name.toLowerCase().includes('due'))

        const dateCards = cards.map((card) => {
            let start: moment.Moment | null = null
            let end: moment.Moment | null = null

            // Try separate properties first
            if (startProp && card.fields.properties[startProp.id]) {
                try {
                    const val = JSON.parse(card.fields.properties[startProp.id] as string)
                    if (val.from) {
                        start = moment(val.from)
                    }
                } catch (e) {
                    // Not a JSON string, try raw string
                    const m = moment(card.fields.properties[startProp.id] as string)
                    if (m.isValid()) {
                        start = m
                    }
                }
            }

            if (endProp && card.fields.properties[endProp.id]) {
                try {
                    const val = JSON.parse(card.fields.properties[endProp.id] as string)
                    if (val.from) {
                        end = moment(val.from)
                    }
                } catch (e) {
                    // Not a JSON string, try raw string
                    const m = moment(card.fields.properties[endProp.id] as string)
                    if (m.isValid()) {
                        end = m
                    }
                }
            }

            // Fallback to selected date property if one of them is missing
            if ((!start || !end) && dateDisplayProperty && card.fields.properties[dateDisplayProperty.id]) {
                try {
                    const val = JSON.parse(card.fields.properties[dateDisplayProperty.id] as string)
                    if (!start && val.from) {
                        start = moment(val.from)
                    }
                    if (!end) {
                        end = moment(val.to || val.from)
                    }
                } catch (e) {}
            }

            if (!start) {
                return null
            }

            return {
                card,
                start,
                end: end || moment(start),
            }
        }).filter((dc) => dc !== null) as {card: Card, start: moment.Moment, end: moment.Moment}[]

        if (dateCards.length === 0) {
            return null
        }

        let minDate = moment(dateCards[0].start)
        let maxDate = moment(dateCards[0].end)

        dateCards.forEach((dc) => {
            if (dc.start.isBefore(minDate)) {
                minDate = moment(dc.start)
            }
            if (dc.end.isAfter(maxDate)) {
                maxDate = moment(dc.end)
            }
        })

        // Buffer of 1 week
        minDate.subtract(1, 'week').startOf('week')
        maxDate.add(1, 'week').endOf('week')

        const totalDays = maxDate.diff(minDate, 'days') + 1

        return {
            dateCards,
            minDate,
            maxDate,
            totalDays,
        }
    }, [cards, dateDisplayProperty])

    if (!dateDisplayProperty) {
        return (
            <div className='Gantt'>
                <div className='no-date-message'>
                    Please select a date property to display the Gantt chart.
                </div>
            </div>
        )
    }

    if (!timelineData) {
        return (
            <div className='Gantt'>
                <div className='no-date-message'>
                    No cards with dates found for the selected property.
                </div>
            </div>
        )
    }

    const {dateCards, minDate, maxDate, totalDays} = timelineData
    const today = moment()
    const todayOffset = today.diff(minDate, 'days')
    const todayPos = (todayOffset / totalDays) * 100
    const totalWeeks = Math.ceil(totalDays / 7)

    const renderHeader = () => {
        const cells = []
        const curr = moment(minDate)
        while (curr.isBefore(maxDate)) {
            cells.push(
                <div key={curr.format('YYYY-MM-DD')} className='gantt-header-cell'>
                    <div className='month'>{curr.format('MMM')}</div>
                    <div className='week'>{curr.format('D')}</div>
                </div>,
            )
            curr.add(1, 'week')
        }
        return (
            <div className='gantt-header'>
                <div className='gantt-header-label-column'>Card Name</div>
                {cells}
            </div>
        )
    }

    return (
        <div className='Gantt' style={{'--total-weeks': totalWeeks} as React.CSSProperties}>
            <div className='gantt-container'>
                {renderHeader()}
                <div className='gantt-body'>
                    {todayOffset >= 0 && todayOffset <= totalDays && (
                        <div 
                            className='today-marker' 
                            style={{left: `calc(250px + ${todayPos} * (100% - 250px) / 100)`}}
                        />
                    )}
                    {dateCards.map((dc) => {
                        const startOffset = dc.start.diff(minDate, 'days')
                        const duration = dc.end.diff(dc.start, 'days') + 1
                        
                        const left = (startOffset / totalDays) * 100
                        const width = (duration / totalDays) * 100

                        const isOverdue = dc.end.isBefore(today, 'day')
                        const cardColor = getCardColor(dc.card, props.board)

                        return (
                            <div key={dc.card.id} className='gantt-row'>
                                <div 
                                    className='gantt-row-label'
                                    onClick={() => showCard(dc.card.id)}
                                    title={dc.card.title}
                                >
                                    {dc.card.title || 'Untitled Card'}
                                </div>
                                <div className='gantt-row-timeline'>
                                    <div 
                                        className={`gantt-bar ${isOverdue ? 'overdue' : ''}`}
                                        style={{
                                            left: `${left}%`,
                                            width: `${width}%`,
                                            backgroundColor: isOverdue ? undefined : cardColor,
                                            boxShadow: isOverdue ? undefined : `0 4px 12px ${cardColor}66`,
                                        }}
                                        onClick={() => showCard(dc.card.id)}
                                        title={`${dc.card.title}: ${dc.start.format('ll')} - ${dc.end.format('ll')}`}
                                    >
                                        {dc.card.title}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default React.memo(Gantt)
