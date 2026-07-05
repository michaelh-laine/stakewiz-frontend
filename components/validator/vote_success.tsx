import { FC, useEffect, useState } from "react";
import axios from "axios";
import config from '../../config.json'
import { Spinner } from '../common'
import Chart from "react-google-charts";
import * as browser from 'lib/browser';
import { getChartOptions, CHART_HEIGHT, SW_CHART_COLORS } from './chartTheme';

const API_URL = process.env.API_BASE_URL;

export const VoteSuccessChart: FC<{vote_identity: string}> = ({vote_identity}) => {
    const [allScores, setAllScores] = useState(null);

    useEffect(() => {
        axios(API_URL+config.API_ENDPOINTS.validator_vote_success+"/"+vote_identity+"?limit=2000", {
            headers: {'Content-Type':'application/json'}
        })
            .then(response => {
            let json = response.data;

            if(json.length>0) {

                let scores = [];
                scores.push([
                    'Date',
                    'Vote Success'
                ]);

                let isSafari:boolean = browser.check('Safari');

                for(var i in json) {
                        if(isSafari){
                            let timeZone = json[i].created_at.slice(-3)+':00';
                            scores.push([new Date(json[i].created_at.substring(0, 19).replace(/-/g, "/")+timeZone), parseFloat(json[i].vote_success)]);
                        }else{
                            scores.push([new Date(json[i].created_at), parseFloat(json[i].vote_success)]);
                        }
                }

                setAllScores(scores);
            }
            })
            .catch(e => {
            console.log(e);
            })
    }, []);


    if(allScores==null) {
        return <Spinner />
    }
    else {
        return (
            <div className="sw-chart-wrap">
                <Chart
                    chartType='LineChart'
                    width="100%"
                    height={CHART_HEIGHT}
                    data={allScores}
                    options={getChartOptions({
                        colors: [SW_CHART_COLORS.accent],
                        vAxisFormat: 'percent'
                    })}
                />
            </div>
        )
    }
}
