import { Component, OnInit, ViewChild, EventEmitter } from '@angular/core';
import { EcowittApiService } from './ecowitt-api.service';
import { Router, NavigationEnd, Event } from '@angular/router';
import { first, filter } from 'rxjs/operators';
import { timer } from 'rxjs';
import { diff, addedDiff, deletedDiff, updatedDiff, detailedDiff } from 'deep-object-diff';
import { CompressionService } from './compression.service';
//import { ChartDataSets, ChartOptions, ChartConfiguration, ChartType, ChartPluginsOptions } from 'chart.js';
import  { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType } from "chart.js";
import * as ChartAnnotation from 'chartjs-plugin-annotation';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import ChartDataLabels from 'chartjs-plugin-datalabels';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent implements OnInit{
  title = 'ecowitt-auditor';
  objectKeys: any = Object.keys;
  weatherReadings: any;
  sensorMappings: {[key: string]: string} = {
    temp_and_humidity_ch1: 'Shed',
    temp_and_humidity_ch2: 'Office',
    temp_and_humidity_ch3: 'Dungeon',
    soil_ch1: 'Dungeon',
    rainfall: 'Rain',
    solar_and_uvi: 'Sun'
  };
  showAllDatasets: boolean = true;

  //chart
  public lineChartType: ChartType = 'line';
  public scatterChartType = 'scatter';
  //public lineChartPlugins = [ChartAnnotation];
 // public lineChartData: ChartConfiguration['data'] = {
  public chartPlugins = [ChartDataLabels];
  public lineChartData: any = {
    datasets: [],
    labels: []
  };
  public appKeysForm: FormGroup = new FormGroup({
    apiKey: new FormControl(),
    appKey: new FormControl(),
  });
  public fetchingData: boolean = true;
  public realTime: any = {};
  public lastRealtimeUpdate: Date = new Date();
  public secondsSinceLastUpdate: number = 0;
  public getNewestWeatherReading: EventEmitter<boolean> = new EventEmitter();
  public types: string[] = ['temperature', 'humidity', 'soilmoisture', 'daily', 'rain_rate', 'solar']; //daily => rainfall


  public lineChartOptions: CustomizeChartOptions = {};
  @ViewChild(BaseChartDirective, { static: true }) chart?: BaseChartDirective;

  constructor(
    public ecowittApiService: EcowittApiService,
    private router: Router,
    private compressionService: CompressionService
  ) { }

  ngOnInit() {

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      first()
    ).subscribe(() => {
      if (document.cookie.includes('gtlweatherapp_app_key') && document.cookie.includes('gtlweatherapp_api_key')) {
        //we have the cookies, so we can get the data
        this.ecowittApiService.API_KEY = document.cookie.split('gtlweatherapp_api_key=')[1].split(';')[0];
        this.ecowittApiService.APPLICATION_KEY = document.cookie.split('gtlweatherapp_app_key=')[1].split(';')[0];
        this.appKeysForm.get('apiKey')?.setValue(this.ecowittApiService.API_KEY);
        this.appKeysForm.get('appKey')?.setValue(this.ecowittApiService.APPLICATION_KEY);
        this.getNewestWeatherReading.emit(true);
      }
      
    });

    this.getNewestWeatherReading.subscribe(() => {
      this.ecowittApiService.executeEcowittApiCall(this.ecowittApiService.getDevices(), {}).subscribe((devices: any) => {
        console.log("devices", devices);
        if (devices.data && devices.data.list && devices.data.list.length > 0) {
          devices.data.list.forEach((device: any) => {
            this.ecowittApiService.executeEcowittApiCall(this.ecowittApiService.getDeviceDetail(device.mac), {}).subscribe((detail: any) => {
              console.log("device detial", detail);
              if (detail && detail.data && detail.data.last_update) {
                let deviceList: deviceMetrics[] = [];
                Object.keys(detail.data.last_update).forEach((sensor: string) => { 
                  Object.keys(detail.data.last_update[sensor]).forEach((measurement: string) => {
                    deviceList.push({
                      sensor: sensor,
                      measurement: measurement,
                      value: detail.data.last_update[sensor][measurement]
                    });
                  });
                });
                console.log("deviceList", deviceList);
                let sensorString = Object.keys(detail.data.last_update).join(',');
                console.log("sensorString", sensorString);
                //get the date now in the format 2022-10-20 23:59:59
                
                //perfom the following every 5 minutes
                timer(0, 1000*60*5).subscribe(() => {
                  this.fetchingData = true;
                  let now = new Date();
                  let nowString = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate()+' '+now.getHours()+':'+now.getMinutes()+':'+now.getSeconds();
                  //get the date 24 hours ago in the format 2022-10-20 23:59:59
                  let yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  let yesterdayString = yesterday.getFullYear()+'-'+(yesterday.getMonth()+1)+'-'+yesterday.getDate()+' '+yesterday.getHours()+':'+yesterday.getMinutes()+':'+yesterday.getSeconds();
                  this.ecowittApiService.executeEcowittApiCall(this.ecowittApiService.getHistory({
                    mac: device.mac,
                    end_date: nowString,
                    start_date: yesterdayString,
                    devices: sensorString //'outdoor,indoor.humidity'
                  }), {}).subscribe((result: any) => {
                    console.log("history", result);
                    this.weatherReadings = result;
                    this.plotChart();
                  });
                });

                timer(500, 1000*30).subscribe(() => {
                  let newDate: Date;
                  
                  this.ecowittApiService.executeEcowittApiCall(this.ecowittApiService.getRealtime({
                    mac: device.mac,
                    devices: sensorString //'outdoor,indoor.humidity'
                  }), {}).subscribe((result: any) => {
                    console.log("realtime", result);
                    if (result && result.data) {
                      Object.keys(result.data).forEach((sensor: string) => {
                        this.types.forEach(type => {
                          if (result.data[sensor][type]) {
                            if (!newDate) newDate = new Date(result.data[sensor][type].time*1000);
                            let label = (this.sensorMappings[sensor] || sensor)+' '+type;
                            this.realTime[label] = result.data[sensor][type];
                            //add this realtime reading to the chart
                            if (this.weatherReadings?.data[sensor][type]) {
                              this.weatherReadings.data[sensor][type].list[result.data[sensor][type].time] = result.data[sensor][type].value;
                            }
                          }
                        });
                      });
                    }
                    console.log(this.realTime);
                    this.lastRealtimeUpdate = newDate;
                    if (this.weatherReadings) this.plotChart();
                  });
                });

                timer(5000, 1000).subscribe(() => {
                  //console.log("updating seconds since last update", this.lastRealtimeUpdate);
                  this.secondsSinceLastUpdate = this.getSecondsAgo(this.lastRealtimeUpdate);
                });


              }
            });
          });
        }
      });
    });

  }

  appKeySubmit() {
    this.ecowittApiService.API_KEY = this.appKeysForm.get('apiKey')?.value;
    this.ecowittApiService.APPLICATION_KEY = this.appKeysForm.get('appKey')?.value;
    document.cookie = "gtlweatherapp_api_key="+this.ecowittApiService.API_KEY;
    document.cookie = "gtlweatherapp_app_key="+this.ecowittApiService.APPLICATION_KEY;
    this.getNewestWeatherReading.emit(true);
  }

  plotChart() {
    console.log("weatherReadings", this.weatherReadings);
    this.lineChartData = {
      datasets: [],
      labels: []
    };

    let labels: {[key: string]: boolean} = {};
    Object.keys(this.weatherReadings.data).forEach((sensor: string) => {
      this.types.forEach(type => {
        if (this.weatherReadings.data[sensor][type]) {
          let temperatures: number[] = [];
          Object.keys(this.weatherReadings.data[sensor][type].list).sort().forEach((timestamp: string) => {
            //console.log("timestamp", timestamp);
            //get date and time with 24 hour format from timestamp
            let date = new Date(parseInt(timestamp)*1000);
            let dateString =date.getFullYear()+'-'+("0" + (date.getMonth()+1)).slice(-2)+'-'+("0" + date.getDate()).slice(-2)+' '+("0" + date.getHours()).slice(-2)+':'+("0" + date.getMinutes()).slice(-2)+':'+("0" + date.getSeconds()).slice(-2);
            //console.log("dateString", dateString);

            temperatures.push(this.weatherReadings.data[sensor][type].list[timestamp]);
            labels[dateString] = true;
          });

          //do a switch case statement for yAxisID based on type
          let yAxisID = 'y-axis-0';
          if (type === 'humidity') yAxisID = 'y-axis-1';
          if (type === 'soilmoisture') yAxisID = 'y-axis-2';
          if (type === 'daily' || type === 'rain_rate') yAxisID = 'y-axis-3';
          if (type === 'solar') yAxisID = 'y-axis-4';

          let tmpD: any = {
            data: temperatures,
            label: (this.sensorMappings[sensor] || sensor)+' '+type,
            fill: false,
            yAxisID: yAxisID,
            tension: 0.4,
            //borderDash: type === 'temperature' ? [] : [5, 5],
            borderWidth: type === 'temperature' ? 4 : 1,
            //xAxisID: 'x-axis-0',
            //type: 'line',
            //borderColor: 'blue',
            //backgroundColor: 'blue',
            //pointBackgroundColor: 'blue',
            //pointBorderColor: 'blue',
            pointRadius: 0,
            datalabels: {
              labels: {
                title: null
              }
            }
          };
          if (type === 'daily') tmpD.borderColor = 'blue';
          if (type === 'soilmoisture') tmpD.borderColor = 'chocolate';
          if (type === 'solar')  {
            tmpD.borderColor = tmpD.backgroundColor = '#F6BE00';
            tmpD.fill = true;
          }
          if (type === 'rain_rate') {
            tmpD.borderColor = tmpD.backgroundColor = 'rgb(95, 162, 247)';
            tmpD.fill = true;
            tmpD.datalabels = {
              labels: {
                title: 'green'
              },
              display: (context: any) => {
                var index = context.dataIndex;
                var value = context.dataset.data[index];
                return value > 5 ? true : false;
              }
            };
          }
          this.lineChartData?.datasets?.push(tmpD);
        }
      });
    });

    this.lineChartData.labels = Object.keys(labels).sort();
    //move the dataset with the label 'Rain daily' to the end of the datasets array
    let rainDailyIndex = this.lineChartData.datasets.findIndex((dataset: any) => dataset.label === 'Rain daily');
    if (rainDailyIndex > -1) {
      let rainDaily = this.lineChartData.datasets.splice(rainDailyIndex, 1);
      this.lineChartData.datasets.push(rainDaily[0]);
    }

    //move the dataset with the label 'Rain rain_rate' to the end of the datasets array
    let rainRateIndex = this.lineChartData.datasets.findIndex((dataset: any) => dataset.label === 'Rain rain_rate');
    if (rainRateIndex > -1) {
      let rainRate = this.lineChartData.datasets.splice(rainRateIndex, 1);
      this.lineChartData.datasets.push(rainRate[0]);
    }

    //move the dataset with the label 'Sun solar' to the end of the datasets array
    let solarIndex = this.lineChartData.datasets.findIndex((dataset: any) => dataset.label === 'Sun solar');
    if (solarIndex > -1) {
      let solar = this.lineChartData.datasets.splice(solarIndex, 1);
      this.lineChartData.datasets.push(solar[0]);
    }
    
    this.lineChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        // We use this empty structure as a placeholder for dynamic theming.
        xAxes: [{
          type: 'time',
          ticks: {
              autoSkip: true,
              maxTicksLimit: 20
          }
        }],
        //xAxes: [{
        //	id: 'x-axis-0',
        //	display: true,
        //	//type: 'linear',
        //	scaleLabel: {
        //		display: true,
        //		labelString: 'm from cell'
        //	},
        //	//ticks: {
        //	//	min: 0,
        //	//	max: parseFloat(properties.terrain[properties.terrain.length -1].d)
        //	//},
        //}],
        yAxes: [
          {
            id: 'y-axis-0',
            position: 'right',
            ticks: {
              //min: 0,
              //max: 50
            },
            scaleLabel: {
              display: true,
              labelString: 'Degrees Celcius'
            }
          },
          { 
            id: 'y-axis-1',
            position: 'right',
            ticks: {
              //min: 0,
              //max: 100
            },
            scaleLabel: {
              display: true,
              labelString: 'Humidity %'
            }
          },
          { 
            id: 'y-axis-2',
            position: 'right',
            ticks: {
              min: 0,
              max: 100
            },
            scaleLabel: {
              display: true,
              labelString: 'Soil Moisture %'
            }
          },
          { 
            id: 'y-axis-3',
            position: 'right',
            ticks: {
              min: 0,
              suggestedMax: 10
            },
            scaleLabel: {
              display: true,
              labelString: 'Rain mm'
            }
          },
          { 
            id: 'y-axis-4',
            position: 'left',
            ticks: {
              min: 0,
              max: 4000
            },
            scaleLabel: {
              display: true,
              labelString: 'Solar'
            }
          },
          //{
          //  id: 'y-axis-1',
          //  position: 'right',
          //  ticks: {
          //    //suggestedMax: maxHeight*2,
          //  },
          //  scaleLabel: {
          //    display: true,
          //    labelString: 'Weighted SINR'
          //  }
          //}
        ]
      },
      tooltips: {
        mode: 'x',
        intersect: false,
      },
      hover: {
        mode: 'x',
        intersect: false
      },
      title: {
        display: true,
            text:'Temperatures & Humidity'
      },
      legend: {
        position: 'top',
        labels: {
        }
      },
      annotation: {
        //annotations: [
        //  {
        //    type: 'line',
        //    scaleID: 'x-axis-0',
        //    value: this._iterationToUse,
        //    borderColor: 'red',
        //    borderWidth: 6,
        //    label: {
        //      //position: 'left',
        //      xAdjust: -250 * (this._iterationToUse < data.rsrp.weighted_rsrp.length / 2 ? -1 : 1),
        //      yAdjust: 30,
        //      enabled: true,
        //      color: 'orange',
        //      content: annotationText,
        //      font: {
        //        weight: 'bold'
        //      }
        //    }
        //  },
        //]
      }
    };
    console.log("lineChartData", this.lineChartData);
    console.log("lineChartOptions", this.lineChartOptions);
    this.fetchingData = false;
  }
  

  showHideDatasets(index?: number) {
    this.lineChartData?.datasets?.forEach((dataset: any, i: number) => {
      if (index === undefined || index === i) {
        Object.keys(dataset._meta).forEach(key => {
          const current = !dataset._meta[key].hidden
          dataset._meta[key].hidden = current || null
          dataset.hidden = current || null;
        });
      }
    });
    //this.chart?.legend.legendItems.forEach((item: any, i: number) => {
    console.log(this.chart);
    this.triggerChartUpdate();
  }

  showHideDatasetsReset() {
    this.lineChartData?.datasets?.forEach((dataset: any) => {
      dataset.hidden = false;
      Object.keys(dataset._meta).forEach(key => {
        dataset._meta[key].hidden = null;
      });
      console.log("dataset", dataset);
    });
    this.triggerChartUpdate();
  }

  showHideDatasetsByType(type: string) {
    this.lineChartData?.datasets?.forEach((dataset: any) => {
      dataset.hidden = dataset.label.includes(type) ? false : true;
      Object.keys(dataset._meta).forEach(key => {
        dataset._meta[key].hidden = (dataset.label.includes(type) ? false : true) || null;
      });
      //console.log("dataset", dataset);
    });
    this.triggerChartUpdate();
  }


  triggerChartUpdate() {
    if (this.chart) {
      this.chart.chart.update();
    }
  }

  //turn and array into an ojects of element => true
  getObjectFromArray(array: any) {
    let obj: any = {};
    array.forEach((item: any) => {
      obj[item.id] = item.time;
    });
    return obj;
  }

  retrieveSegmentData(segmentId: number, snapshotData: any) {
    let segment = snapshotData.find((segment:any) => segment.segment.id === segmentId);
    return segment;
  }


  parseDate(date: number) {
    //console.log("date", date);
    let d = new Date(date)
    return d.toDateString()+',  '+d.toLocaleTimeString();
  }

  getSecondsAgo(d: Date) {
    let now = new Date();
    let diff = now.getTime() - d.getTime();
    let seconds = Math.floor(diff / 1000);
    return seconds;
  }

  //pace in minutes per km
  paceMinutesAndSecondsPerKm(time: number, distance: number) {
    let pace = time / (distance / 1000);
    return this.timeMinutesAndSeconds(pace);
  }

  //fractions of a minute to rounded seconds
  timeFractions(time: number) {
    let timeFractions = time % 60;
    return Math.round(timeFractions);
  }

  //time in minutes and seconds
  timeMinutesAndSeconds(time: number) {
    let minutes = time > 0 ? Math.floor(time / 60) : Math.ceil(time / 60);
    let seconds = Math.abs(Math.round(time - minutes * 60));
    return (time < 0 ? '-' : '') + minutes +':'+ (seconds < 10 ? '0'+seconds : seconds);
  }

  //time in hours and minutes
  timeHoursAndMinutes(time: number) {
    let hours = Math.floor(time / 60);
    let minutes = Math.round(time - hours * 60);
    return hours +':'+ (minutes < 10 ? '0'+minutes : minutes);
  }

  //time in minutes and seconds
  timeHoursMinutesAndSeconds(time: number) {
    let minutes = time > 0 ? Math.floor(time / 60) : Math.ceil(time / 60);
    let seconds = Math.abs(Math.round(time - minutes * 60));
    return (time < 0 ? '-' : '') + this.timeHoursAndMinutes(minutes) +':'+ (seconds < 10 ? '0'+seconds : seconds);
  }

  extractDateFromSnapshotName(snapshotName: string) {
    let d = new Date(Number(snapshotName.split('_')[0]));
    return d.toDateString()+',  '+d.toLocaleTimeString();
  }

  metersToKm(meters: number) {
    return (meters / 1000).toFixed(2)+' km';
  }

  

}

export interface deviceMetrics {
  sensor: string;
  measurement: string;
  value: any;
}

interface CustomizeChartOptions extends ChartOptions {
  annotation?: any;
}