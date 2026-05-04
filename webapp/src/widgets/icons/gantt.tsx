// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './gantt.scss'

export default function GanttIcon(): JSX.Element {
    return (
        <svg
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='currentColor'
            xmlns='http://www.w3.org/2000/svg'
            className='GanttIcon Icon'
        >
            <rect x='4' y='6' width='8' height='3' rx='1' fill='currentColor'/>
            <rect x='10' y='11' width='10' height='3' rx='1' fill='currentColor'/>
            <rect x='6' y='16' width='12' height='3' rx='1' fill='currentColor'/>
        </svg>
    )
}
