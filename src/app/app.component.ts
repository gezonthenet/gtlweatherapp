import { Component, OnInit, ViewChild, EventEmitter } from '@angular/core';
import { EcowittApiService } from './ecowitt-api.service';
import { Router, NavigationEnd, Event } from '@angular/router';
import { first, filter } from 'rxjs/operators';
import { Subscription, timer } from 'rxjs';
import { diff, addedDiff, deletedDiff, updatedDiff, detailedDiff } from 'deep-object-diff';
import { CompressionService } from './compression.service';
import  { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions, ChartType } from "chart.js";
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Annotation from 'chartjs-plugin-annotation';
import 'chartjs-adapter-moment';

Chart.register(Annotation);

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
    temp_and_humidity_ch4: 'Subfloor',
    temp_and_humidity_ch5: 'Bedroom',
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
  public appKeysForm: UntypedFormGroup = new UntypedFormGroup({
    apiKey: new UntypedFormControl(),
    appKey: new UntypedFormControl(),
  });
  public fetchingData: boolean = true;
  public realTime: any = {};
  public lastRealtimeUpdate: Date = new Date();
  public secondsSinceLastUpdate: number = 0;
  public getNewestWeatherReading: EventEmitter<boolean> = new EventEmitter();
  public types: string[] = ['temperature', 'humidity', 'soilmoisture', 'daily', 'rain_rate', 'solar']; //daily => rainfall
  public timeOptions: string[] = ['24h', '48h', '7d', '1m', '3m', '6m', '1y', '2y', '5y'];
  public selectedTimeOption: string = '24h';
  public defaultSelectedTimeOption: string = '24h';
  public wideMode: boolean = false;
  public firstSub: Subscription = new Subscription();
  public secondSub: Subscription = new Subscription();
  public thirdSub: Subscription = new Subscription();


  public lineChartOptions: CustomizeChartOptions = {};
  @ViewChild(BaseChartDirective, { static: true }) chart?: BaseChartDirective;

  public datasetVisibilityTracking: {[key: number]: boolean} = {};

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
      }

      console.log("url", this.router);
      if (this.router.url.includes('apiKey') && this.router.url.includes('appKey')) {
        this.ecowittApiService.API_KEY = this.router.url.split('apiKey=')[1].split('&')[0];
        this.ecowittApiService.APPLICATION_KEY = this.router.url.split('appKey=')[1].split('&')[0];
        this.appKeysForm.get('apiKey')?.setValue(this.ecowittApiService.API_KEY);
        this.appKeysForm.get('appKey')?.setValue(this.ecowittApiService.APPLICATION_KEY);
      }

      //get the time option from the url parameter timeOption
      if (this.router.url.includes('timeOption')) {
        this.selectedTimeOption = this.router.url.split('timeOption=')[1].split('&')[0];
      } else {
        this.selectedTimeOption = this.defaultSelectedTimeOption;
      }

      //if we have the app and api keys, then we can get the data
      if (this.ecowittApiService.API_KEY && this.ecowittApiService.APPLICATION_KEY) {
        this.getNewestWeatherReading.emit(true);
      }
    });

    //allow the apiKey and appKey to be set via url parameters
    

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
                this.firstSub.unsubscribe();
                this.firstSub = timer(0, 1000*60*5).subscribe(() => {
                  this.fetchingData = true;
                  let now = new Date();
                  let nowString = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate()+' '+now.getHours()+':'+now.getMinutes()+':'+now.getSeconds();
                  //get the date 24 hours ago in the format 2022-10-20 23:59:59
                  //get the offset date based on the selected time option, make it customisable by looking at the digit and the unit (h, d, m, y)
                  let offsetDate = new Date();
                  let offset = 0;
                  if (this.selectedTimeOption.includes('h')) {
                    offset = parseInt(this.selectedTimeOption.split('h')[0]);
                    offsetDate.setHours(offsetDate.getHours() - offset);
                  } else if (this.selectedTimeOption.includes('d')) {
                    offset = parseInt(this.selectedTimeOption.split('d')[0]);
                    offsetDate.setDate(offsetDate.getDate() - offset);
                  } else if (this.selectedTimeOption.includes('m')) {
                    offset = parseInt(this.selectedTimeOption.split('m')[0]);
                    offsetDate.setMonth(offsetDate.getMonth() - offset);
                  } else if (this.selectedTimeOption.includes('y')) {
                    offset = parseInt(this.selectedTimeOption.split('y')[0]);
                    offsetDate.setFullYear(offsetDate.getFullYear() - offset);
                  }
                  

                  let offsetDateString = offsetDate.getFullYear()+'-'+(offsetDate.getMonth()+1)+'-'+offsetDate.getDate()+' '+offsetDate.getHours()+':'+offsetDate.getMinutes()+':'+offsetDate.getSeconds();
                  this.ecowittApiService.executeEcowittApiCall(this.ecowittApiService.getHistory({
                    mac: device.mac,
                    end_date: nowString,
                    start_date: offsetDateString,
                    devices: sensorString //'outdoor,indoor.humidity'
                  }), {}).subscribe((result: any) => {
                    console.log("history", result);
                    this.weatherReadings = result;
                    this.plotChart();
                  });
                });

                this.secondSub.unsubscribe();
                this.secondSub = timer(500, 1000*30).subscribe(() => {
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

                this.thirdSub.unsubscribe();
                this.thirdSub = timer(5000, 1000).subscribe(() => {
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
          let yAxisID = 'y';
          if (type === 'humidity') yAxisID = 'y1';
          if (type === 'soilmoisture') yAxisID = 'y2';
          if (type === 'daily' || type === 'rain_rate') yAxisID = 'y3';
          if (type === 'solar') yAxisID = 'y4';

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
            //borderColor: '',
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
        x: {
          type: 'time',
          ticks: {
              autoSkip: true,
              maxTicksLimit: 20
          }
        },
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
        y: {
          position: 'right',
          //min: 0,
          //max: 50,
          title: {
            display: true,
            text: 'Degrees Celcius'
          }
        },
        y1: { 
          position: 'right',
          //min: 0,
          //max: 100,
          title: {
            display: true,
            text: 'Humidity %'
          }
        },
        y2:{ 
          position: 'right',
          min: 0,
          max: 100,
          title: {
            display: true,
            text: 'Soil Moisture %'
          }
        },
        y3: { 
          position: 'right',
          min: 0,
          suggestedMax: 10,
          title: {
            display: true,
            text: 'Rain mm'
          }
        },
        y4: { 
          position: 'left',
          min: 0,
          max: 4000,
          title: {
            display: true,
            text: 'Solar'
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
      },
      plugins: {
        tooltip: {
          mode: 'x',
          intersect: false,
        },
        title: {
          display: true,
              text:'Temperatures & Humidity'
        },
        legend: {
          display: false,
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

      },
      hover: {
        mode: 'x',
        intersect: false
      },
      
    };
    console.log("lineChartData", this.lineChartData);
    console.log("lineChartOptions", this.lineChartOptions);
    this.fetchingData = false;
    timer(50).subscribe(() => {
      this.updateDatasetVisibility();
    });
  }

  updateDatasetVisibility() {
    console.log("updateDatasetVisibility", this.datasetVisibilityTracking);
    this.lineChartData?.datasets?.forEach((dataset: any, i: number) => {
      if (this.datasetVisibilityTracking[i] !== undefined) {
        dataset.hidden = !this.datasetVisibilityTracking[i];
      }
    });
    console.log(this.chart);
    this.triggerChartUpdate();
  }
  

  showHideDatasets(index?: number) {
    this.lineChartData?.datasets?.forEach((dataset: any, i: number) => {
      if (index === undefined || index === i) {
        //Object.keys(dataset._meta).forEach(key => {
        //  const current = !dataset._meta[key].hidden
        //  dataset._meta[key].hidden = current || null
        //});
        dataset.hidden = !dataset.hidden;
        this.datasetVisibilityTracking[i] = !dataset.hidden;
      }
    });
    console.log(this.chart);
    this.triggerChartUpdate();
  }

  showHideDatasetsReset() {
    this.lineChartData?.datasets?.forEach((dataset: any, i: number) => {
      dataset.hidden = false;
      this.datasetVisibilityTracking[i] = true;
      //Object.keys(dataset._meta).forEach(key => {
      //  dataset._meta[key].hidden = null;
      //});
      console.log("dataset", dataset);
    });
    this.triggerChartUpdate();
  }

  showHideDatasetsByType(type: string) {
    this.lineChartData?.datasets?.forEach((dataset: any, i: number) => {
      dataset.hidden = dataset.label.includes(type) ? false : true;
      this.datasetVisibilityTracking[i] = !dataset.hidden;
      //Object.keys(dataset._meta).forEach(key => {
      //  dataset._meta[key].hidden = (dataset.label.includes(type) ? false : true) || null;
      //});
      //console.log("dataset", dataset);
    });
    this.triggerChartUpdate();
  }


  triggerChartUpdate() {
    if (this.chart?.chart) {
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