import { FC, useEffect, useState } from "react";
import axios from "axios";
import config from '../../config.json'
import { Spinner } from '../common'
import Chart from "react-google-charts";
import Calendar from '../calendar';

const API_URL = process.env.API_BASE_URL;

export const DelinquencyChart: FC<{vote_identity: string, first_epoch: number}> = ({vote_identity, first_epoch}) => {
    const [delinquencies, setDelinquencies] = useState(null);
    const [allEpochs, setAllEpochs] = useState(null)
    const [startDate, setStartDate] = useState(null)
    
    useEffect(() => {
        axios(API_URL+config.API_ENDPOINTS.validator_delinquencies+"/"+vote_identity, {
            headers: {'Content-Type':'application/json'}
        })
            .then(async (response) => {
                let json: [] = response.data;

                let d: Object = {};

                json.forEach((delinquency: any) => {
                        d[delinquency.date] = delinquency.delinquent_minutes
                })

                setDelinquencies(d);
            })
            .catch(e => {
            console.log(e);
            })
        axios(API_URL+config.API_ENDPOINTS.all_epoch_history, {
            headers: {'Content-Type':'application/json'}
        })
            .then(async (response) => {
                let json: [] = response.data;
                setAllEpochs(json)
                let epoch:any = json.find((epoch: any) => epoch.epoch == first_epoch)
                let start_date = new Date(epoch.start)
                setStartDate(start_date.getFullYear()+'-'+(start_date.getMonth()+1)+'-'+start_date.getDate())

            })
            .catch(e => {
            console.log(e);
            })
    }, []);

    const today = new Date();
    let year = today.getFullYear()
    let month: string|number = today.getMonth() + 1
    let day = today.getDate();
    if(month<10) month = '0'+month
    const until = year+'-'+month+'-'+day

    if(delinquencies==null) {
        
        return <Spinner />
    
    }
    else {
        return (
            <div className='sw-calendar-wrap'>
                <Calendar
                    key='del1'
                    values={delinquencies}
                    until={until}
                    start={startDate}
                    weekLabelAttributes={{ style: { fill: '#8a97c3', fontSize: 10, fontFamily: 'system-ui, sans-serif' } }}
                    monthLabelAttributes={{ style: { fill: '#8a97c3', fontSize: 11, fontFamily: 'system-ui, sans-serif' } }}
                    panelColors={['rgba(148, 163, 216, 0.14)', '#4ade80', '#ffcc4d', '#ffb547', '#ff8a3d', '#ff6b7a']}
                    panelAttributes={{ rx: 2, ry: 2, style: { stroke: 'transparent' } }}
                />
            </div>
        )
    }
}
