import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { Angular2CsvModule } from 'angular2-csv';
import { CompressionService } from './compression.service';
import { ChartsModule  } from 'ng2-charts';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ChartsModule,
    HttpClientModule,
    Angular2CsvModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [CompressionService],
  bootstrap: [AppComponent]
})
export class AppModule { }
